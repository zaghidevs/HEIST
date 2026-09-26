import "server-only";
import { q } from "./db";
import { env } from "./env";
import { parsePlayerName, playerId, splitPlayerId, type Platform } from "./players-parse";

export type Player = {
  id: string;            // "twitch:name" | "kick:name" | "sc:name"
  platform: Platform;
  name: string;
  title: string;         // display name
  avatarUrl: string | null;
  bio: string;           // profile description, used for ownership checks ("" for Social Club)
};

/* ---------------- Twitch (Helix API, app access token) ---------------- */

let twitchToken: { value: string; exp: number } | null = null;
async function twitchAppToken(): Promise<string> {
  if (twitchToken && twitchToken.exp > Date.now() + 60_000) return twitchToken.value;
  const body = new URLSearchParams({ client_id: env.twitchClientId, client_secret: env.twitchClientSecret, grant_type: "client_credentials" });
  const r = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", body, cache: "no-store" });
  if (!r.ok) throw new Error(`Twitch auth ${r.status}`);
  const j = await r.json();
  twitchToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return twitchToken.value;
}

async function fetchTwitch(name: string): Promise<Player | null> {
  const token = await twitchAppToken();
  const r = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(name)}`, {
    headers: { "Client-Id": env.twitchClientId, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Twitch API ${r.status}`);
  const u = (await r.json()).data?.[0];
  if (!u) return null;
  return { id: playerId("twitch", u.login), platform: "twitch", name: u.login, title: u.display_name || u.login, avatarUrl: u.profile_image_url || null, bio: u.description || "" };
}

/* ---------------- Kick (public API, app access token) ---------------- */

let kickToken: { value: string; exp: number } | null = null;
async function kickAppToken(): Promise<string> {
  if (kickToken && kickToken.exp > Date.now() + 60_000) return kickToken.value;
  const body = new URLSearchParams({ client_id: env.kickClientId, client_secret: env.kickClientSecret, grant_type: "client_credentials" });
  const r = await fetch("https://id.kick.com/oauth/token", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" }, cache: "no-store" });
  if (!r.ok) throw new Error(`Kick auth ${r.status}`);
  const j = await r.json();
  kickToken = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return kickToken.value;
}

async function fetchKick(name: string): Promise<Player | null> {
  const token = await kickAppToken();
  const r = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Kick API ${r.status}`);
  const c = (await r.json()).data?.[0];
  if (!c) return null;
  const slug = String(c.slug || name).toLowerCase();
  return {
    id: playerId("kick", slug),
    platform: "kick",
    name: slug,
    title: c.slug || name,
    avatarUrl: c.profile_picture || c.banner_picture || null,
    bio: String(c.channel_description ?? c.description ?? ""),
  };
}

/* ---------------- Social Club (no public API: name only, ownership checked by hand) ---------------- */

function socialClub(name: string): Player {
  return { id: playerId("sc", name), platform: "sc", name, title: name, avatarUrl: null, bio: "" };
}

export function platformEnabled(p: Platform): boolean {
  if (p === "twitch") return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
  if (p === "kick") return !!(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET);
  return true;
}

async function fetchPlayer(platform: Platform, name: string): Promise<Player | null> {
  if (platform === "twitch") return fetchTwitch(name);
  if (platform === "kick") return fetchKick(name);
  return socialClub(name);
}

/** Resolves user input to a player and caches the public profile. */
export async function resolvePlayer(platform: Platform, input: string): Promise<Player | null> {
  const name = parsePlayerName(platform, input);
  if (!name) return null;
  const p = await fetchPlayer(platform, name);
  if (p) await upsertPlayer(p);
  return p;
}

/** Always hits the platform (no cache), used for ownership checks. */
export async function fetchPlayerFresh(id: string): Promise<Player | null> {
  const s = splitPlayerId(id);
  if (!s) return null;
  return fetchPlayer(s.platform, s.name);
}

export async function upsertPlayer(p: Player) {
  await q(
    `INSERT INTO channels (channel_id, platform, handle, title, avatar_url)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (channel_id) DO UPDATE SET handle=$3, title=$4, avatar_url=COALESCE($5, channels.avatar_url), updated_at=now()`,
    [p.id, p.platform, p.name, p.title, p.avatarUrl],
  );
}
