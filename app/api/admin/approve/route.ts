import { q } from "@/lib/db";
import { adminKeyOk } from "@/lib/admin";
import { ok, fail, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Approve (or reject) a Social Club ownership code after checking the player's proof by hand.
export const POST = route(async (req: Request) => {
  const { key, code, approve } = await req.json().catch(() => ({}));
  if (!adminKeyOk(key)) return fail("Wrong admin key", 401);
  if (typeof code !== "string") return fail("Missing code");
  if (approve === false) {
    await q(`DELETE FROM claim_codes WHERE code=$1`, [code]);
    return ok({ removed: true });
  }
  const rows = await q(`UPDATE claim_codes SET approved_at=now() WHERE code=$1 AND expires_at > now() RETURNING channel_id`, [code.trim().toUpperCase()]);
  if (rows.length === 0) return fail("No live code like that", 404);
  return ok({ approved: true, channelId: rows[0].channel_id });
});
