// Pure helpers for players (unit tested). No network, no dependencies.
// A player id is "<platform>:<name>", e.g. "twitch:summit1g", "kick:xqc", "sc:getawaydriver".

export type Platform = "twitch" | "kick" | "sc";
export const PLATFORMS: Platform[] = ["twitch", "kick", "sc"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  twitch: "Twitch",
  kick: "Kick",
  sc: "Rockstar Social Club",
};

const NAME_RE: Record<Platform, RegExp> = {
  twitch: /^[a-z0-9_]{3,25}$/,   // Twitch logins
  kick: /^[a-z0-9_-]{3,30}$/,    // Kick channel slugs
  sc: /^[a-z0-9_.-]{6,16}$/,     // Social Club nicknames (6-16 chars)
};

export function isPlatform(p: unknown): p is Platform {
  return typeof p === "string" && (PLATFORMS as string[]).includes(p);
}

/** Accepts a name, @name or profile URL for the platform and returns the normalised name. */
export function parsePlayerName(platform: Platform, raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  const hosts: Record<Platform, RegExp> = {
    twitch: /(^|\.)twitch\.tv$/i,
    kick: /(^|\.)kick\.com$/i,
    sc: /(^|\.)rockstargames\.com$/i,
  };
  if (/^https?:\/\//i.test(s) || /\.(tv|com)\//i.test(s)) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
      if (!hosts[platform].test(u.hostname)) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      // socialclub.rockstargames.com/member/<name>
      s = platform === "sc" ? (parts[0] === "member" ? parts[1] ?? "" : parts[0] ?? "") : parts[0] ?? "";
    } catch {
      return null;
    }
  }
  s = s.replace(/^@/, "").toLowerCase();
  return NAME_RE[platform].test(s) ? s : null;
}

export function playerId(platform: Platform, name: string): string {
  return `${platform}:${name}`;
}

export function splitPlayerId(id: string): { platform: Platform; name: string } | null {
  const i = id.indexOf(":");
  if (i < 1) return null;
  const platform = id.slice(0, i);
  const name = id.slice(i + 1);
  if (!isPlatform(platform) || !NAME_RE[platform].test(name)) return null;
  return { platform, name };
}

export function isPlayerId(id: unknown): id is string {
  return typeof id === "string" && splitPlayerId(id) !== null;
}

export function profileUrl(id: string): string | null {
  const p = splitPlayerId(id);
  if (!p) return null;
  if (p.platform === "twitch") return `https://www.twitch.tv/${p.name}`;
  if (p.platform === "kick") return `https://kick.com/${p.name}`;
  return `https://socialclub.rockstargames.com/member/${p.name}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** A short code like "HEIST-7KQ2-M9XD" the player pastes into their bio. */
export function makeClaimCode(randomBytes: Uint8Array, prefix = "HEIST"): string {
  if (randomBytes.length < 8) throw new Error("need 8 random bytes");
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Case-insensitive, whitespace-tolerant check that the bio contains the code. */
export function bioHasCode(bio: string, code: string): boolean {
  const norm = (x: string) => x.toUpperCase().replace(/\s+/g, "");
  return norm(bio).includes(norm(code));
}

/** Link to a player's page on this site. */
export function playerPath(id: string): string {
  const p = splitPlayerId(id);
  return p ? `/player/${p.platform}/${p.name}` : "/";
}
