import { randomBytes } from "node:crypto";
import { claimNonceHash } from "@/lib/claim-nonce";
import { q } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { platformEnabled, resolvePlayer } from "@/lib/players";
import { isPlatform, makeClaimCode, PLATFORM_LABEL } from "@/lib/players-parse";

export const dynamic = "force-dynamic";

// Step 1 of proving ownership: get a one-time code.
export const POST = route(async (req: Request) => {
  const { platform, input } = await req.json().catch(() => ({}));
  if (!isPlatform(platform)) return fail("Pick Social Club, Twitch or Kick");
  if (!platformEnabled(platform)) return fail(`${PLATFORM_LABEL[platform]} isn't switched on yet`, 503);
  if (typeof input !== "string" || !input.trim()) return fail("Type your name");
  const p = await resolvePlayer(platform, input);
  if (!p) return fail(`No ${PLATFORM_LABEL[platform]} account found with that name`, 404);

  const nonceHash = claimNonceHash(true)!;
  await q(`DELETE FROM claim_codes WHERE expires_at < now()`);
  // Reuse this browser's live code so a refresh doesn't invalidate what was already pasted or sent.
  const [existing] = await q(`SELECT code FROM claim_codes WHERE channel_id=$1 AND nonce_hash=$2 AND expires_at > now()`, [p.id, nonceHash]);
  const code = existing?.code ?? makeClaimCode(randomBytes(8));
  if (!existing) {
    // Social Club checks are done by hand, so those codes live longer.
    const ttl = p.platform === "sc" ? "3 days" : "2 hours";
    await q(`INSERT INTO claim_codes (code, channel_id, nonce_hash, expires_at) VALUES ($1,$2,$3, now() + $4::interval)`, [code, p.id, nonceHash, ttl]);
  }
  return ok({ channelId: p.id, platform: p.platform, title: p.title, handle: p.name, avatarUrl: p.avatarUrl, code });
});
