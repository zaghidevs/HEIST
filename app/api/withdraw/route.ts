import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { q, tx } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { balanceLocked, lockChannel } from "@/lib/ledger";
import { currentSession } from "@/lib/session";
import { connection, crank, isValidPubkey, solUsd, treasury } from "@/lib/solana";
import { sendAndConfirm } from "@/lib/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_WITHDRAW = 5_000_000n; // 0.005 SOL
const TREASURY_RENT_FLOOR = 890_880n;

export const POST = route(async (req: Request) => {
  const s = currentSession();
  if (!s) return fail("Verify your channel first", 401);
  const { destination } = await req.json().catch(() => ({}));
  if (typeof destination !== "string" || !isValidPubkey(destination)) return fail("Enter a valid Solana wallet address");
  const dest = new PublicKey(destination);
  const tre = treasury();
  if (dest.equals(tre.publicKey)) return fail("That is the treasury address");

  const conn = connection();
  const payer = crank();

  // Reserve the whole balance under the channel lock, and write the receipt before sending.
  const prepared = await tx(async (c) => {
    await lockChannel(c, s.channelId);
    const bal = await balanceLocked(c, s.channelId);
    if (bal.claimable < MIN_WITHDRAW) return { error: `Nothing to withdraw yet (minimum is 0.005 SOL)` } as const;

    const treasuryBal = BigInt(await conn.getBalance(tre.publicKey, "confirmed"));
    if (treasuryBal - TREASURY_RENT_FLOOR < bal.claimable) {
      // Should never happen if the ledger and the treasury agree. Stop and let a human look.
      console.error("TREASURY SHORTFALL", { channel: s.channelId, owed: bal.claimable.toString(), treasury: treasuryBal.toString() });
      return { error: "Withdrawals are paused for a safety check. Your balance is safe; try again later." } as const;
    }

    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const t = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });
    t.add(SystemProgram.transfer({ fromPubkey: tre.publicKey, toPubkey: dest, lamports: bal.claimable }));
    t.sign(payer, tre);
    const signature = bs58.encode(t.signature!);

    const r = await c.query(
      `INSERT INTO receipts (kind, channel_id, lamports, destination, signature, last_valid_height, status, sol_usd)
       VALUES ('claim',$1,$2,$3,$4,$5,'pending',$6) RETURNING seq`,
      [s.channelId, bal.claimable.toString(), dest.toBase58(), signature, lastValidBlockHeight, await solUsd()],
    );
    return { seq: r.rows[0].seq as string, raw: t.serialize(), signature, blockhash, lastValidBlockHeight, lamports: bal.claimable };
  });
  if ("error" in prepared) return fail(prepared.error!);

  const res = await sendAndConfirm(prepared.raw, prepared.signature, prepared.blockhash, prepared.lastValidBlockHeight);
  if (res.ok) {
    await q(`UPDATE receipts SET status='sent', settled_at=now() WHERE seq=$1`, [prepared.seq]);
    return ok({ status: "sent", signature: res.signature, lamports: prepared.lamports.toString() });
  }
  if (res.definite) {
    await q(`UPDATE receipts SET status='failed', note=$2, settled_at=now() WHERE seq=$1`, [prepared.seq, res.error.slice(0, 300)]);
    return fail("The withdrawal did not go through; your balance is unchanged. Try again.", 502);
  }
  // Unknown outcome: the crank settles it once the transaction lands or its blockhash expires.
  return ok({ status: "pending", signature: res.signature, lamports: prepared.lamports.toString() });
});
