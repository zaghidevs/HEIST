// Signed session tokens for a verified channel owner. Node crypto only (unit tested).
import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = { channelId: string; exp: number }; // exp: unix seconds

const b64url = (b: Buffer) => b.toString("base64url");

export function signSession(s: Session, secret: string): string {
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET too short");
  const body = b64url(Buffer.from(JSON.stringify(s)));
  const mac = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifySession(token: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000)): Session | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof s.channelId !== "string" || typeof s.exp !== "number") return null;
    if (s.exp <= nowSec) return null;
    return s;
  } catch {
    return null;
  }
}
