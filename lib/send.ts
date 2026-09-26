import "server-only";
import { connection } from "./solana";

/**
 * definite=true means the transaction certainly did not land (it failed simulation or
 * failed on chain), so any balance it reserved can be released. definite=false means we
 * could not tell (timeout, network error): leave it pending and let reconcile decide
 * once its blockhash has expired.
 */
export type SendResult =
  | { ok: true; signature: string }
  | { ok: false; signature: string; error: string; definite: boolean };

export async function sendAndConfirm(raw: Buffer | Uint8Array, signature: string, blockhash: string, lastValidBlockHeight: number): Promise<SendResult> {
  const conn = connection();
  try {
    await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 5, preflightCommitment: "confirmed" });
  } catch (e: any) {
    const logs: string[] | undefined = e?.logs ?? e?.transactionLogs;
    const simulated = Array.isArray(logs) || /simulation failed/i.test(e?.message ?? "");
    return { ok: false, signature, definite: simulated, error: (logs?.slice(-3).join(" | ") || e?.message || "send failed").slice(0, 400) };
  }
  try {
    const res = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) return { ok: false, signature, definite: true, error: JSON.stringify(res.value.err) };
    return { ok: true, signature };
  } catch (e: any) {
    return { ok: false, signature, definite: false, error: e?.message || "confirmation failed" };
  }
}
