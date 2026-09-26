"use client";
import { useState } from "react";
import type { Platform } from "@/lib/players-parse";

export type PickedPlayer = {
  channelId: string;
  platform: Platform;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  launchesBlocked?: boolean;
  claimed?: boolean;
  code?: string;
};

const LABEL: Record<Platform, { name: string; hint: string; placeholder: string }> = {
  sc: { name: "GTA player", hint: "Rockstar Social Club name", placeholder: "their Social Club name" },
  twitch: { name: "Twitch", hint: "RP streamer channel", placeholder: "twitch.tv/name or name" },
  kick: { name: "Kick", hint: "RP streamer channel", placeholder: "kick.com/name or name" },
};

export function platformName(p: Platform) {
  return p === "sc" ? "Social Club" : LABEL[p].name;
}

export function PlayerCard({ p }: { p: PickedPlayer }) {
  return (
    <div className="channel">
      {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <div className="avatar">{p.title.slice(0, 1).toUpperCase()}</div>}
      <div>
        <div className="t">{p.title}</div>
        <div className="muted small">{platformName(p.platform)} · {p.handle}</div>
      </div>
    </div>
  );
}

export default function PlayerPicker({ onPick, endpoint = "/api/channel/lookup", cta = "Find", enabled }: {
  onPick: (p: PickedPlayer) => void;
  endpoint?: string;
  cta?: string;
  enabled: Record<Platform, boolean>;
}) {
  const [platform, setPlatform] = useState<Platform>("sc");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ platform, input }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Lookup failed");
      onPick(j);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go}>
      <div className="seg" role="group" aria-label="Where the player is">
        {(["sc", "twitch", "kick"] as Platform[]).map((p) => (
          <button key={p} type="button" aria-pressed={platform === p} disabled={!enabled[p]} onClick={() => setPlatform(p)} title={enabled[p] ? undefined : "Coming soon"}>
            {LABEL[p].name}<small>{enabled[p] ? LABEL[p].hint : "coming soon"}</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={LABEL[platform].placeholder} aria-label={LABEL[platform].hint} autoComplete="off" />
        <button className="btn" disabled={busy || !input.trim()}>{busy ? "Looking…" : cta}</button>
      </div>
      {err && <div className="notice err">{err}</div>}
    </form>
  );
}
