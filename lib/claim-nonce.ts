import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "hs_claim_nonce";

/** A per-browser secret: only the browser that requested a claim code can redeem it. */
export function claimNonceHash(create: boolean): string | null {
  let nonce = cookies().get(COOKIE)?.value;
  if (!nonce) {
    if (!create) return null;
    nonce = randomBytes(24).toString("base64url");
    cookies().set(COOKIE, nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 3 });
  }
  return createHash("sha256").update(nonce).digest("hex");
}
