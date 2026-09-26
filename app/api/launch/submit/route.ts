import { PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { q } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { readRoute } from "@/lib/pump";
import { sendAndConfirm } from "@/lib/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const { intentId, signed } = await req.json().catch(() => ({}));
  if (typeof intentId !== "string" || !Array.isArray(signed) || signed.length !== 2) return fail("Bad request");

  const [intent] = await q(`SELECT * FROM launch_intents WHERE id=$1`, [intentId]);
  if (!intent) return fail("Launch not found", 404);
  if (intent.submitted_at) return fail("This launch was already submitted", 409);

  // Accept the wallet's bytes only if the message is exactly the one we built.
  // A wallet may add signatures and nothing else.
  const txs: Transaction[] = [];
  const expected = [intent.create_msg, intent.sharing_msg];
  for (let i = 0; i < 2; i++) {
    let t: Transaction;
    try {
      t = Transaction.from(Buffer.from(String(signed[i]), "base64"));
    } catch {
      return fail("Could not read the signed transaction");
    }
    if (t.serializeMessage().toString("base64") !== expected[i]) return fail("The wallet changed the transaction; launch again");
    txs.push(t);
  }
  txs[0].addSignature(new PublicKey(intent.mint), Buffer.from(intent.mint_signature, "base64"));
  for (const t of txs) if (!t.verifySignatures()) return fail("A signature is missing or invalid");

  // Claim the intent atomically so a double click cannot send twice.
  const claimed = await q(`UPDATE launch_intents SET submitted_at=now() WHERE id=$1 AND submitted_at IS NULL RETURNING id`, [intentId]);
  if (claimed.length === 0) return fail("This launch was already submitted", 409);

  const lvh = Number(intent.last_valid_height);
  const sigOf = (t: Transaction) => bs58.encode(t.signature!);

  const create = await sendAndConfirm(txs[0].serialize(), sigOf(txs[0]), intent.blockhash, lvh);
  if (!create.ok) return fail(`Coin was not created: ${create.error}`, 502);

  await q(
    `INSERT INTO coins (mint, channel_id, launcher, name, symbol, image_uri, create_sig)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (mint) DO NOTHING`,
    [intent.mint, intent.channel_id, intent.launcher, intent.name, intent.symbol, intent.image_uri, create.signature],
  );

  const routeRes = await sendAndConfirm(txs[1].serialize(), sigOf(txs[1]), intent.blockhash, lvh);
  const state = routeRes.ok ? await readRoute(new PublicKey(intent.mint)) : { ok: false as const, reason: routeRes.error };
  await q(`UPDATE coins SET sharing_sig=$2, route_status=$3, route_checked_at=now() WHERE mint=$1`, [
    intent.mint,
    routeRes.signature,
    state.ok ? "routed" : "unrouted",
  ]);

  return ok({
    mint: intent.mint,
    routed: state.ok,
    warning: state.ok ? null : `The coin is live but fee routing failed (${state.reason}). Fees stay with the launcher wallet.`,
  });
});
