import "server-only";
import { Pool, type PoolClient } from "pg";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __tpPool: Pool | undefined;
}

export function pool(): Pool {
  if (!global.__tpPool) {
    global.__tpPool = new Pool({
      connectionString: env.databaseUrl,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(env.databaseUrl) ? undefined : { rejectUnauthorized: false },
    });
  }
  return global.__tpPool;
}

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(text, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
