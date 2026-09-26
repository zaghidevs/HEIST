import { q } from "@/lib/db";
import { ok, fail, route } from "@/lib/http";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// A verified player can stop new coins being launched in their name.
// Existing coins keep routing fees to them (the split is locked on chain).
export const POST = route(async (req: Request) => {
  const s = currentSession();
  if (!s) return fail("Sign in first", 401);
  const { blocked } = await req.json().catch(() => ({}));
  await q(`UPDATE channels SET launches_blocked=$2 WHERE channel_id=$1`, [s.channelId, !!blocked]);
  return ok({ blocked: !!blocked });
});
