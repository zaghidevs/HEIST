import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import { signSession, verifySession, type Session } from "./session-core";

const COOKIE = "hs_session";
const TTL_SEC = 60 * 60 * 24 * 7; // a week

export function currentSession(): Session | null {
  return verifySession(cookies().get(COOKIE)?.value, env.sessionSecret);
}

export function startSession(channelId: string) {
  const token = signSession({ channelId, exp: Math.floor(Date.now() / 1000) + TTL_SEC }, env.sessionSecret);
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_SEC });
}

export function endSession() {
  cookies().delete(COOKIE);
}
