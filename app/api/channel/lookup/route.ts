import { q } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { platformEnabled, resolvePlayer } from "@/lib/players";
import { isPlatform, PLATFORM_LABEL } from "@/lib/players-parse";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const { platform, input } = await req.json().catch(() => ({}));
  if (!isPlatform(platform)) return fail("Pick Social Club, Twitch or Kick");
  if (!platformEnabled(platform)) return fail(`${PLATFORM_LABEL[platform]} isn't switched on yet`, 503);
  if (typeof input !== "string" || !input.trim()) return fail("Type the player's name");
  const p = await resolvePlayer(platform, input);
  if (!p) return fail(platform === "sc" ? "That isn't a valid Social Club name (6-16 letters, numbers, _ . -)" : `No ${PLATFORM_LABEL[platform]} channel found with that name`, 404);
  const [row] = await q(`SELECT launches_blocked, claimed_at FROM channels WHERE channel_id=$1`, [p.id]);
  return ok({
    channelId: p.id,
    platform: p.platform,
    title: p.title,
    handle: p.name,
    avatarUrl: p.avatarUrl,
    launchesBlocked: !!row?.launches_blocked,
    claimed: !!row?.claimed_at,
  });
});
