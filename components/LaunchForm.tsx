"use client";
import { useState } from "react";
import Link from "next/link";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./NavWallet";
import PlayerPicker, { PlayerCard, type PickedPlayer } from "./PlayerPicker";
import { b64ToBytes, bytesToB64, squareImage } from "./b64";
import type { Platform } from "@/lib/players-parse";

type Stage = "form" | "building" | "signing" | "sending" | "done";

export default function LaunchForm({ platformBps, enabled }: { platformBps: number; enabled: Record<Platform, boolean> }) {
  const wallet = useWallet();
  const [pl, setPl] = useState<PickedPlayer | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ mint: string; routed: boolean; warning: string | null } | null>(null);

  const playerPct = (10_000 - platformBps) / 100;
  const ready = !!pl && !pl.launchesBlocked && name.trim() && symbol.trim() && image && wallet.publicKey;

  function pickImage(f: File | null) {
    setImage(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function launch() {
    if (!ready || !wallet.publicKey || !pl || !image) return;
    setErr(null);
    try {
      setStage("building");
      const fd = new FormData();
      fd.set("channelId", pl.channelId);
      fd.set("name", name);
      fd.set("symbol", symbol);
      fd.set("description", description);
      fd.set("website", "");
      fd.set("launcher", wallet.publicKey.toBase58());
      fd.set("image", await squareImage(image), "coin.png");
      const r = await fetch("/api/launch/prepare", { method: "POST", body: fd });
      const prep = await r.json();
      if (!r.ok) throw new Error(prep.error || "Could not build the launch");

      setStage("signing");
      const txs = (prep.transactions as string[]).map((t) => Transaction.from(b64ToBytes(t)));
      let signed: Transaction[];
      if (wallet.signAllTransactions) signed = await wallet.signAllTransactions(txs);
      else if (wallet.signTransaction) signed = [await wallet.signTransaction(txs[0]), await wallet.signTransaction(txs[1])];
      else throw new Error("This wallet can't sign transactions");

      setStage("sending");
      const s = await fetch("/api/launch/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intentId: prep.intentId, signed: signed.map((t) => bytesToB64(t.serialize())) }),
      });
      const sub = await s.json();
      if (!s.ok) throw new Error(sub.error || "Launch failed");
      setResult(sub);
      setStage("done");
    } catch (e: any) {
      setErr(e?.message?.includes("User rejected") ? "You cancelled in your wallet." : e.message);
      setStage("form");
    }
  }

  if (stage === "done" && result) {
    return (
      <div className="launch-card glass">
        <h2>${symbol.toUpperCase()} is live</h2>
        {result.routed ? (
          <div className="notice ok">Creator fees are locked to {pl?.title}'s cut. The split can never be changed.</div>
        ) : (
          <div className="notice err">{result.warning}</div>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          <Link className="btn" href={`/coin/${result.mint}`}>Open coin page</Link>
          <a className="btn ghost" href={`https://pump.fun/coin/${result.mint}`} target="_blank" rel="noreferrer">View on pump.fun</a>
        </div>
      </div>
    );
  }

  const busy = stage !== "form";
  return (
    <div className="launch-card glass">
      <div className="lbl" style={{ marginTop: 0 }}>Who gets the cut?</div>
      {pl ? (
        <>
          <PlayerCard p={pl} />
          {pl.launchesBlocked && <div className="notice err">This player has turned off new coins in their name.</div>}
          <button className="btn ghost small" style={{ marginTop: 12 }} onClick={() => setPl(null)} disabled={busy}>Change player</button>
        </>
      ) : (
        <PlayerPicker onPick={setPl} enabled={enabled} />
      )}

      <div className="grid two" style={{ gap: 14 }}>
        <div><label htmlFor="lName">Coin name</label><input id="lName" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Getaway Driver" disabled={busy} /></div>
        <div><label htmlFor="lTicker">Ticker</label><input id="lTicker" value={symbol} maxLength={13} onChange={(e) => setSymbol(e.target.value.replace(/\s/g, ""))} placeholder="GETAWAY" disabled={busy} /></div>
      </div>
      <label htmlFor="lImg">Image</label>
      <div className="row">
        {preview && <img src={preview} alt="" className="coin-img" />}
        <input id="lImg" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} disabled={busy} />
      </div>
      <label htmlFor="lDesc">Description</label>
      <textarea id="lDesc" value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} placeholder="What's the coin about?" disabled={busy} />

      <div className="split" style={{ marginTop: 18 }}>
        Creator fees: {playerPct}% to {pl ? `${pl.title}'s` : "the player's"} cut{platformBps > 0 && <>, {platformBps / 100}% to HEIST</>}. Locked on-chain at launch.
      </div>

      <div style={{ marginTop: 16 }}>
        {wallet.publicKey ? (
          <button className="btn" style={{ width: "100%" }} onClick={launch} disabled={!ready || busy}>
            {stage === "building" ? "Uploading & building…" : stage === "signing" ? "Approve in Phantom…" : stage === "sending" ? "Launching…" : "Launch the coin"}
          </button>
        ) : (
          <WalletButton full />
        )}
      </div>
      {err && <div className="notice err">{err}</div>}
      <p className="muted small" style={{ marginBottom: 0 }}>
        You'll sign twice: once to create the coin, once to lock where its fees go. The player doesn't need to know yet:
        their cut waits until they prove the account is theirs. By launching you confirm the coin doesn't claim to be made
        or endorsed by the player or Rockstar.
      </p>
    </div>
  );
}
