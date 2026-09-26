import "server-only";
import { q } from "./db";

export async function siteStats() {
  const [r] = await q(`
    SELECT
      (SELECT COALESCE(SUM(lamports),0) FROM receipts WHERE kind='push' AND status='sent')  AS routed,
      (SELECT COALESCE(SUM(lamports),0) FROM receipts WHERE kind='claim' AND status='sent') AS withdrawn,
      (SELECT COUNT(*) FROM coins WHERE route_status='routed')                             AS coins,
      (SELECT COUNT(DISTINCT channel_id) FROM coins)                                       AS channels`);
  return r as { routed: string; withdrawn: string; coins: string; channels: string };
}

export async function recentCoins(limit = 12) {
  return q(`SELECT c.*, ch.title AS channel_title, ch.avatar_url AS channel_avatar
            FROM coins c JOIN channels ch USING (channel_id)
            ORDER BY c.created_at DESC LIMIT $1`, [limit]);
}

/** Channels ranked by fees credited, including the ones still waiting to be claimed. */
export async function leaderboard(limit = 10) {
  return q(`
    SELECT ch.channel_id, ch.title, ch.handle, ch.avatar_url, ch.claimed_at,
           COALESCE(SUM(r.lamports) FILTER (WHERE r.kind='push' AND r.status='sent'),0) AS credited,
           COALESCE(SUM(r.lamports) FILTER (WHERE r.kind='claim' AND r.status IN ('pending','sent','held')),0) AS debited
    FROM channels ch JOIN receipts r USING (channel_id)
    GROUP BY ch.channel_id ORDER BY credited DESC LIMIT $1`, [limit]);
}

export async function receiptsWhere(where: string, params: unknown[], limit = 100) {
  return q(`SELECT r.*, ch.title AS channel_title, c.symbol
            FROM receipts r JOIN channels ch USING (channel_id) LEFT JOIN coins c ON c.mint = r.mint
            WHERE r.status <> 'failed' ${where ? "AND " + where : ""}
            ORDER BY r.seq DESC LIMIT ${Number(limit)}`, params);
}
