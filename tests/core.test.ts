import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlayerName, playerId, splitPlayerId, isPlayerId, makeClaimCode, bioHasCode, playerPath, profileUrl } from "../lib/players-parse.ts";
import { signSession, verifySession } from "../lib/session-core.ts";
import { decodeSharingConfig, decodeBondingCurve, routeProblem, expectedSplit } from "../lib/layouts.ts";
import { lamportsToSol, receiptNo, validateCoinFields, usd } from "../lib/format.ts";

const ID = "twitch:summit1g";

test("parses player names and profile links per platform", () => {
  assert.equal(parsePlayerName("twitch", "Summit1G"), "summit1g");
  assert.equal(parsePlayerName("twitch", "@summit1g"), "summit1g");
  assert.equal(parsePlayerName("twitch", "https://www.twitch.tv/summit1g/videos"), "summit1g");
  assert.equal(parsePlayerName("twitch", "twitch.tv/summit1g"), "summit1g");
  assert.equal(parsePlayerName("kick", "https://kick.com/some-streamer"), "some-streamer");
  assert.equal(parsePlayerName("sc", "Getaway_Driver"), "getaway_driver");
  assert.equal(parsePlayerName("sc", "https://socialclub.rockstargames.com/member/Getaway_Driver"), "getaway_driver");
});

test("rejects names and links from the wrong place", () => {
  assert.equal(parsePlayerName("twitch", ""), null);
  assert.equal(parsePlayerName("twitch", "https://kick.com/someone"), null);
  assert.equal(parsePlayerName("kick", "https://evil-kick.com/x"), null);
  assert.equal(parsePlayerName("sc", "abc"), null); // Social Club names are 6-16 characters
  assert.equal(parsePlayerName("twitch", "has space"), null);
});

test("player ids round-trip and build links", () => {
  const id = playerId("twitch", "summit1g");
  assert.equal(id, "twitch:summit1g");
  assert.deepEqual(splitPlayerId(id), { platform: "twitch", name: "summit1g" });
  assert.ok(isPlayerId("sc:getaway_driver"));
  assert.ok(!isPlayerId("youtube:someone"));
  assert.ok(!isPlayerId("twitch:"));
  assert.equal(playerPath("kick:xqc"), "/player/kick/xqc");
  assert.equal(profileUrl("sc:getaway_driver"), "https://socialclub.rockstargames.com/member/getaway_driver");
});

test("claim codes are well formed and matched loosely", () => {
  const code = makeClaimCode(new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253]));
  assert.match(code, /^HEIST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.ok(!/[01IO]/.test(code.slice(6)));
  assert.ok(bioHasCode(`RP every night!\n${code.toLowerCase()}\nfollow`, code));
  assert.ok(bioHasCode(`code: ${code.replace("-", " - ")}`, code));
  assert.ok(!bioHasCode("HEIST-AAAA-BBBB", code));
  assert.throws(() => makeClaimCode(new Uint8Array(4)));
});

test("sessions verify, expire, and resist tampering", () => {
  const secret = "x".repeat(32);
  const now = 1_000_000;
  const tok = signSession({ channelId: ID, exp: now + 60 }, secret);
  assert.deepEqual(verifySession(tok, secret, now), { channelId: ID, exp: now + 60 });
  assert.equal(verifySession(tok, secret, now + 61), null, "expired");
  assert.equal(verifySession(tok, "y".repeat(32), now), null, "wrong secret");
  const [body, mac] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ channelId: "UCattackerattackerattack", exp: now + 60 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${mac}`, secret, now), null, "swapped body");
  assert.equal(verifySession(`${body}.`, secret, now), null);
  assert.equal(verifySession(undefined, secret, now), null);
  assert.throws(() => signSession({ channelId: ID, exp: 1 }, "short"));
});

// ---- on-chain layouts: build accounts byte-for-byte per pump.fun's IDL ----
const key = (n: number) => new Uint8Array(32).fill(n);
function sharingConfigBytes(o: { status: number; revoked: boolean; holders: [Uint8Array, number][] }) {
  const parts: number[] = [216, 74, 9, 0, 56, 140, 93, 75, 254, 2, o.status, ...key(7), ...key(8), o.revoked ? 1 : 0];
  const n = o.holders.length;
  parts.push(n & 255, (n >> 8) & 255, 0, 0);
  for (const [k, bps] of o.holders) parts.push(...k, bps & 255, bps >> 8);
  return new Uint8Array(parts);
}
function bondingCurveBytes(complete: boolean, creator: Uint8Array) {
  const b = new Uint8Array(8 + 40 + 1 + 32 + 64);
  b.set([23, 183, 248, 55, 96, 216, 172, 96]);
  const v = new DataView(b.buffer);
  [1n, 2n, 3n, 4n, 1_000_000_000_000_000n].forEach((x, i) => v.setBigUint64(8 + i * 8, x, true));
  b[48] = complete ? 1 : 0;
  b.set(creator, 49);
  return b;
}

test("decodes the sharing config and bonding curve", () => {
  const T = key(1), P = key(2);
  const cfg = decodeSharingConfig(sharingConfigBytes({ status: 1, revoked: true, holders: [[P, 500], [T, 9500]] }));
  assert.equal(cfg.version, 2);
  assert.equal(cfg.status, "Active");
  assert.equal(cfg.adminRevoked, true);
  assert.deepEqual(cfg.mint, key(7));
  assert.equal(cfg.shareholders.length, 2);
  assert.equal(cfg.shareholders[1].shareBps, 9500);
  const bc = decodeBondingCurve(bondingCurveBytes(true, key(9)));
  assert.equal(bc.complete, true);
  assert.equal(bc.tokenTotalSupply, 1_000_000_000_000_000n);
  assert.deepEqual(bc.creator, key(9));
  assert.throws(() => decodeSharingConfig(bondingCurveBytes(false, key(9))), /not a SharingConfig/);
});

test("route check accepts only our exact, locked split", () => {
  const T = key(1), P = key(2), X = key(3);
  const withCut = expectedSplit(T, P, 500);
  const full = expectedSplit(T, null, 0);
  const cfg = (o: Parameters<typeof sharingConfigBytes>[0]) => decodeSharingConfig(sharingConfigBytes(o));

  assert.equal(routeProblem(cfg({ status: 1, revoked: true, holders: [[T, 10000]] }), full), null);
  assert.equal(routeProblem(cfg({ status: 1, revoked: true, holders: [[P, 500], [T, 9500]] }), withCut), null);
  assert.match(routeProblem(cfg({ status: 1, revoked: false, holders: [[T, 10000]] }), full)!, /can still be changed/);
  assert.match(routeProblem(cfg({ status: 0, revoked: true, holders: [[T, 10000]] }), full)!, /paused/);
  assert.match(routeProblem(cfg({ status: 1, revoked: true, holders: [[X, 10000]] }), full)!, /unexpected/);
  assert.match(routeProblem(cfg({ status: 1, revoked: true, holders: [[T, 9000], [X, 1000]] }), full)!, /unexpected/);
  assert.match(routeProblem(cfg({ status: 1, revoked: true, holders: [[P, 600], [T, 9400]] }), withCut)!, /unexpected/);

  assert.throws(() => expectedSplit(T, P, 2500), /0\.\.2000/);
  assert.throws(() => expectedSplit(T, T, 500), /differ/);
  assert.deepEqual(expectedSplit(T, P, 0), full, "0 bps means no platform holder");
});

test("formatting", () => {
  assert.equal(lamportsToSol(1_234_567_890n), "1.2345");
  assert.equal(lamportsToSol("5000000", 3), "0.005");
  assert.equal(lamportsToSol(0), "0.0000");
  assert.equal(receiptNo(42), "HS-000042");
  assert.equal(usd(2_000_000_000n, 150), "$300.00");
  assert.equal(usd(1n, null), null);
  assert.equal(validateCoinFields("Ok", "OK"), null);
  assert.match(validateCoinFields("x".repeat(33), "OK")!, /32/);
  assert.match(validateCoinFields("Ok", "WAYTOOLONGTICKER")!, /13/);
  assert.match(validateCoinFields("Ok", "B@D")!, /letters/);
});
