import { claimNonceHash } from "@/lib/claim-nonce";
import { q } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { fetchPlayerFresh } from "@/lib/players";
import { bioHasCode, isPlayerId, PLATFORM_LABEL, splitPlayerId } from "@/lib/players-parse";
import { startSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Step 2: Twitch / Kick: read the bio straight from the platform and look for this browser's code.
//         Social Club: check an admin approved this browser's code.
export const POST = route(async (req: Request) => {
  const { channelId } = await req.json().catch(() => ({}));
  if (!isPlayerId(channelId)) return fail("Bad player");
  const { platform } = splitPlayerId(channelId)!;
  const nonceHash = claimNonceHash(false);
  if (!nonceHash) return fail("Start again from this browser to get a code.", 410);
  const [row] = await q(`SELECT code, approved_at FROM claim_codes WHERE channel_id=$1 AND nonce_hash=$2 AND expires_at > now()`, [channelId, nonceHash]);
  if (!row) return fail("Your code expired. Start again to get a new one.", 410);

  if (platform === "sc") {
    if (!row.approved_at) return fail("Not approved yet. Once we've checked your proof, press verify again.", 409);
  } else {
    const p = await fetchPlayerFresh(channelId);
    if (!p) return fail("Account not found", 404);
    if (!bioHasCode(p.bio, row.code)) {
      return fail(`The code isn't in your ${PLATFORM_LABEL[platform]} bio yet. It can take a minute to update; try again shortly.`, 409);
    }
  }

  await q(`DELETE FROM claim_codes WHERE code=$1`, [row.code]);
  await q(`UPDATE channels SET claimed_at = COALESCE(claimed_at, now()) WHERE channel_id=$1`, [channelId]);
  startSession(channelId);
  return ok({ verified: true });
});
