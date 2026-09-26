import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

export function adminKeyOk(given: unknown): boolean {
  if (typeof given !== "string" || !process.env.ADMIN_KEY) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(env.adminKey);
  return a.length === b.length && timingSafeEqual(a, b);
}
