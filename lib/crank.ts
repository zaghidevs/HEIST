import "server-only";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { pool, q } from "./db";
import { readRoute, waitingLamports, pushIxs } from "./pump";
import { connection, crank, solUsd, treasury } from "./solana";
import { sendAndConfirm } from "./send";

const MIN_PUSH = 1_000_000n; // ~0.001 SOL, around pump.fun's minimum distributable fee
const MAX_PUSHES_PER_RUN = 20;
const TIME_BUDGET_MS = 45_000;

/** What actually arrived in the treasury in a confirmed push transaction. */
async function treasuryDelta(signature: string): Promise<bigint | null> {
  const t = await connection().getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!t?.meta || t.meta.err) return null;
  const keys = t.transaction.message.getAccountKeys().staticAccountKeys;
  const i = keys.findIndex((k) => k.equals(treasury().publicKey));
  if (i < 0) return 0n;
  return BigInt(t.meta.postBalances[i]) - BigInt(t.meta.preBalances[i]);
}

async function settlePush(seq: string, signature: string) {
  const delta = await treasuryDelta(signature);
  if (delta == null) {
    await q(`UPDATE receipts SET status='failed', note='transaction failed', settled_at=now() WHERE seq=$1`, [seq]);
    return;
  }
  if (delta < 0n) {
    await q(`UPDATE receipts SET status='held', note='treasury balance went down in a push', settled_at=now() WHERE seq=$1`, [seq]);
    return;
  }
  await q(`UPDATE receipts SET status='sent', lamports=$2, sol_usd=$3, settled_at=now() WHERE seq=$1`, [seq, delta.toString(), await solUsd()]);
}

/** Resolves receipts whose transaction outcome we did not see (timeouts, crashes). */
export async function reconcile() {
  const rows = await q(`SELECT seq, kind, signature, last_valid_height FROM receipts
                        WHERE status='pending' AND created_at < now() - interval '20 seconds' ORDER BY seq LIMIT 100`);
  if (rows.length === 0) return 0;
  const conn = connection();
  const statuses = await conn.getSignatureStatuses(rows.map((r) => r.signature), { searchTransactionHistory: true });
  const height = await conn.getBlockHeight("confirmed");
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const st = statuses.value[i];
    const landed = st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized");
    if (landed && st!.err) {
      await q(`UPDATE receipts SET status='failed', note='failed on chain', settled_at=now() WHERE seq=$1`, [r.seq]);
    } else if (landed) {
      if (r.kind === "push") await settlePush(r.seq, r.signature);
      else await q(`UPDATE receipts SET status='sent', settled_at=now() WHERE seq=$1`, [r.seq]);
    } else if (!st && height > Number(r.last_valid_height)) {
      // Blockhash expired and the network never saw it: it can never land.
      await q(`UPDATE receipts SET status='failed', note='expired without landing', settled_at=now() WHERE seq=$1`, [r.seq]);
    }
  }
  return rows.length;
}

async function pushCoin(mint: PublicKey, channelId: string, includeAmm: boolean) {
  const payer = crank();
  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");
  const t = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });
  t.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20_000 }));
  t.add(...(await pushIxs({ mint, payer: payer.publicKey, includeAmm })));
  t.sign(payer);
  const signature = bs58.encode(t.signature!);

  // Write the receipt before sending, so a crash mid-send is picked up by reconcile.
  const [row] = await q(
    `INSERT INTO receipts (kind, channel_id, mint, lamports, signature, last_valid_height, status)
     VALUES ('push',$1,$2,0,$3,$4,'pending') RETURNING seq`,
    [channelId, mint.toBase58(), signature, lastValidBlockHeight],
  );
  const res = await sendAndConfirm(t.serialize(), signature, blockhash, lastValidBlockHeight);
  if (res.ok) await settlePush(row.seq, signature);
  else if (res.definite) await q(`UPDATE receipts SET status='failed', note=$2, settled_at=now() WHERE seq=$1`, [row.seq, res.error.slice(0, 300)]);
}

/** One crank pass: reconcile, re-check every coin's route, push what has cleared the minimum. */
export async function runCrank(): Promise<{ reconciled: number; checked: number; pushed: number; skipped?: string }> {
  const lockClient = await pool().connect();
  try {
    const [{ got }] = (await lockClient.query(`SELECT pg_try_advisory_lock(771001) AS got`)).rows;
    if (!got) return { reconciled: 0, checked: 0, pushed: 0, skipped: "another crank is running" };

    const started = Date.now();
    const reconciled = await reconcile();
    const coins = await q(`SELECT mint, channel_id FROM coins WHERE route_status <> 'unrouted' OR route_checked_at < now() - interval '1 hour'
                           ORDER BY vault_waiting_lamports DESC, route_checked_at NULLS FIRST LIMIT 500`);
    let checked = 0;
    let pushed = 0;
    for (const c of coins) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const mint = new PublicKey(c.mint);
      try {
        const route = await readRoute(mint);
        checked++;
        if (!route.ok) {
          await q(`UPDATE coins SET route_status='unrouted', route_checked_at=now() WHERE mint=$1`, [c.mint]);
          continue;
        }
        const w = await waitingLamports(mint, route.graduated);
        const total = w.curve + w.amm;
        await q(`UPDATE coins SET route_status='routed', route_checked_at=now(), vault_waiting_lamports=$2 WHERE mint=$1`, [c.mint, total.toString()]);
        if (total >= MIN_PUSH && pushed < MAX_PUSHES_PER_RUN) {
          // Never two pushes for one coin in flight at once.
          const inflight = await q(`SELECT 1 FROM receipts WHERE mint=$1 AND kind='push' AND status='pending' LIMIT 1`, [c.mint]);
          if (inflight.length === 0) {
            await pushCoin(mint, c.channel_id, w.amm > 0n);
            pushed++;
            await q(`UPDATE coins SET vault_waiting_lamports=0 WHERE mint=$1`, [c.mint]);
          }
        }
      } catch (e) {
        console.error("crank", c.mint, e);
      }
    }
    return { reconciled, checked, pushed };
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock(771001)`).catch(() => {});
    lockClient.release();
  }
}
