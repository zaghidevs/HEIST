import "server-only";
import type { PoolClient } from "pg";
import { q } from "./db";

// Credited = confirmed pushes. Debited = every withdrawal that is in flight, done, or on hold.
const BALANCE_SQL = `
  SELECT
    COALESCE(SUM(lamports) FILTER (WHERE kind='push'  AND status='sent'), 0)                        AS credited,
    COALESCE(SUM(lamports) FILTER (WHERE kind='claim' AND status IN ('pending','sent','held')), 0)   AS debited,
    COALESCE(SUM(lamports) FILTER (WHERE kind='claim' AND status='sent'), 0)                        AS withdrawn
  FROM receipts WHERE channel_id = $1`;

export type Balance = { credited: bigint; withdrawn: bigint; claimable: bigint };

function toBalance(r: any): Balance {
  const credited = BigInt(r.credited);
  const debited = BigInt(r.debited);
  return { credited, withdrawn: BigInt(r.withdrawn), claimable: credited - debited };
}

export async function balanceOf(channelId: string): Promise<Balance> {
  const [r] = await q(BALANCE_SQL, [channelId]);
  return toBalance(r);
}

/** Same, inside a transaction that already holds the channel's lock. */
export async function balanceLocked(c: PoolClient, channelId: string): Promise<Balance> {
  const r = await c.query(BALANCE_SQL, [channelId]);
  return toBalance(r.rows[0]);
}

/** Serialises every balance-changing write for one channel. Released at COMMIT/ROLLBACK. */
export async function lockChannel(c: PoolClient, channelId: string) {
  await c.query("SELECT pg_advisory_xact_lock(hashtext('channel:' || $1))", [channelId]);
}

export async function totalLiabilities(): Promise<bigint> {
  const [r] = await q(`
    SELECT COALESCE(SUM(lamports) FILTER (WHERE kind='push' AND status='sent'),0)
         - COALESCE(SUM(lamports) FILTER (WHERE kind='claim' AND status IN ('pending','sent','held')),0) AS owed
    FROM receipts`);
  return BigInt(r.owed);
}
