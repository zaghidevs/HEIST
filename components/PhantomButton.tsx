"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";

const PHANTOM = "Phantom" as WalletName<"Phantom">;

const isMobile = () => typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/** Opens this page inside Phantom's in-app browser (phones without the extension). */
function openInPhantom() {
  const url = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
}

export default function PhantomButton({ full = false }: { full?: boolean }) {
  const { wallets, wallet, select, connect, disconnect, connected, connecting, publicKey } = useWallet();
  const [wantConnect, setWantConnect] = useState(false);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const phantom = wallets.find((w) => w.adapter.name === PHANTOM);
  const installed = phantom && (phantom.readyState === WalletReadyState.Installed || phantom.readyState === WalletReadyState.Loadable);

  // select() is async inside the provider: connect once Phantom is the selected wallet.
  useEffect(() => {
    if (!wantConnect || wallet?.adapter.name !== PHANTOM || connected || connecting) return;
    setWantConnect(false);
    connect().catch(() => {});
  }, [wantConnect, wallet, connected, connecting, connect]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function onConnect() {
    if (!installed) {
      if (isMobile()) openInPhantom();
      else window.open("https://phantom.com/download", "_blank", "noopener");
      return;
    }
    select(PHANTOM);
    setWantConnect(true);
  }

  const icon = phantom?.adapter.icon ? <img src={phantom.adapter.icon} alt="" width={18} height={18} style={{ borderRadius: 5 }} /> : null;

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className="phantom-wrap" ref={ref}>
        <button className={`btn phantom connected${full ? " full" : ""}`} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
          {icon}
          <span className="mono">{addr.slice(0, 4)}…{addr.slice(-4)}</span>
          <span className="dot" aria-hidden />
        </button>
        {menu && (
          <div className="phantom-menu card" role="menu">
            <button role="menuitem" onClick={async () => { await navigator.clipboard.writeText(addr).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
              {copied ? "Copied" : "Copy address"}
            </button>
            <a role="menuitem" href={`https://solscan.io/account/${addr}`} target="_blank" rel="noreferrer">View on Solscan</a>
            <button role="menuitem" onClick={() => { setMenu(false); disconnect().catch(() => {}); }}>Disconnect</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button className={`btn phantom${full ? " full" : ""}`} onClick={onConnect} disabled={connecting}>
      {icon}
      {connecting ? "Connecting…" : installed ? "Connect Phantom" : isMobile() ? "Open in Phantom" : "Get Phantom"}
    </button>
  );
}
