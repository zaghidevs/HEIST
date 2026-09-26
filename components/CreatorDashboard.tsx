"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatorDashboard({ claimable, claimableSol, blocked }: { claimable: string; claimableSol: string; blocked: boolean }) {
  const router = useRouter();
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const canWithdraw = BigInt(claimable) >= 5_000_000n;

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }

  async function withdraw() {
    setBusy(true);
    setMsg(null);
    try {
      const j = await post("/api/withdraw", { destination: dest.trim() });
      setMsg({
        kind: "ok",
        text: j.status === "sent" ? `Sent ${claimableSol} SOL. Transaction ${j.signature.slice(0, 10)}…` : "Sent to the network; it's confirming and will show on your receipts shortly.",
      });
      router.refresh();
    } catch (e: any) {
      setMsg({ kind: "err", text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card">
        <h2>Withdraw your cut</h2>
        <div className="stat"><div className="v">{claimableSol} SOL</div><div className="k">available now</div></div>
        <label>Your Solana wallet address</label>
        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="e.g. from Phantom or an exchange SOL deposit address" />
        <button className="btn" style={{ marginTop: 12 }} disabled={!canWithdraw || !dest.trim() || busy} onClick={withdraw}>
          {busy ? "Sending…" : "Withdraw everything"}
        </button>
        {!canWithdraw && <div className="muted small" style={{ marginTop: 8 }}>The minimum withdrawal is 0.005 SOL. We pay the network fee.</div>}
        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}
      </div>
      <div className="card">
        <h2>Settings</h2>
        <label style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--text)" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            defaultChecked={blocked}
            onChange={async (e) => {
              try { await post("/api/claim/block", { blocked: e.target.checked }); router.refresh(); } catch (er: any) { setMsg({ kind: "err", text: er.message }); }
            }}
          />
          Don't allow new coins in my name
        </label>
        <p className="muted small">Coins that already exist keep paying you: their split is locked on-chain and can't be changed by anyone.</p>
        <button className="btn ghost small" onClick={async () => { await post("/api/claim/logout", {}); router.refresh(); }}>Sign out</button>
      </div>
    </div>
  );
}
