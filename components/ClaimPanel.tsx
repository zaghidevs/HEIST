"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayerPicker, { PlayerCard, type PickedPlayer } from "./PlayerPicker";
import type { Platform } from "@/lib/players-parse";

const X_HANDLE = "@heistlaunchpad";

export default function ClaimPanel({ enabled }: { enabled: Record<Platform, boolean> }) {
  const router = useRouter();
  const [started, setStarted] = useState<PickedPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function verify() {
    if (!started) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/claim/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId: started.channelId }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Verification failed");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!started?.code) return;
    try { await navigator.clipboard.writeText(started.code); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  }

  if (!started) {
    return (
      <div className="launch-card glass">
        <div className="lbl" style={{ marginTop: 0 }}>Where's your account?</div>
        <PlayerPicker endpoint="/api/claim/start" cta="Continue" enabled={enabled} onPick={setStarted} />
      </div>
    );
  }

  const sc = started.platform === "sc";
  const where = started.platform === "twitch" ? "Twitch" : "Kick";
  return (
    <div className="launch-card glass">
      <PlayerCard p={started} />
      <ol className="steps" style={{ marginTop: 18 }}>
        <li>
          Copy your code:
          <div className="code-box" onClick={copy} title="Click to copy">{started.code}</div>
          <button className="btn ghost small" onClick={copy}>{copied ? "Copied" : "Copy code"}</button>
        </li>
        {sc ? (
          <>
            <li>
              Social Club has no public profile we can read, so we check by hand. Send the code in a DM to{" "}
              <a href="https://x.com/heistlaunchpad" target="_blank" rel="noreferrer">{X_HANDLE}</a> on X, together with a
              screenshot of you <b>logged in to socialclub.rockstargames.com</b> on the <b>{started.handle}</b> profile.
            </li>
            <li>
              Once we reply that you're approved (usually within a day), come back <b>on this same browser</b> and press verify.
              <div style={{ marginTop: 10 }}><button className="btn" onClick={verify} disabled={busy}>{busy ? "Checking…" : "I'm approved, verify"}</button></div>
            </li>
          </>
        ) : (
          <>
            <li>
              Paste the code anywhere in your <b>{where} bio</b> ({where === "Twitch" ? "Settings → Profile → Bio" : "Settings → Profile → Bio"}) and save.
            </li>
            <li>
              Come back and press verify. Once you're in, you can remove the code from your bio.
              <div style={{ marginTop: 10 }}><button className="btn" onClick={verify} disabled={busy}>{busy ? `Checking ${where}…` : "Verify my account"}</button></div>
            </li>
          </>
        )}
      </ol>
      {err && <div className="notice err">{err}</div>}
      <p className="muted small">
        The code only works from this browser{sc ? " and expires in 3 days" : " and expires in 2 hours"}. We never ask for
        your password and never get access to your account.
      </p>
      <button className="btn ghost small" onClick={() => setStarted(null)}>Use a different account</button>
    </div>
  );
}
