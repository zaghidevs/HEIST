import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import Receipts from "@/components/Receipts";
import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { lamportsToSol } from "@/lib/format";
import { readRoute } from "@/lib/pump";
import { receiptsWhere } from "@/lib/queries";
import { pda, treasury, platformWallet } from "@/lib/solana";
import { playerPath, PLATFORM_LABEL, splitPlayerId } from "@/lib/players-parse";

export const dynamic = "force-dynamic";

export default async function CoinPage({ params }: { params: { mint: string } }) {
  const [coin] = await q(
    `SELECT c.*, ch.title, ch.handle, ch.avatar_url FROM coins c JOIN channels ch USING (channel_id) WHERE c.mint=$1`,
    [params.mint],
  );
  if (!coin) notFound();

  // Read the route from chain on every visit, so a change can't hide behind our database.
  let live: { ok: boolean; reason?: string };
  try {
    const r = await readRoute(new PublicKey(coin.mint));
    live = r.ok ? { ok: true } : { ok: false, reason: r.reason };
  } catch {
    live = { ok: false, reason: "could not reach Solana right now" };
  }
  const [sums] = await q(`SELECT COALESCE(SUM(lamports) FILTER (WHERE status='sent'),0) AS routed FROM receipts WHERE mint=$1 AND kind='push'`, [coin.mint]);
  const receipts = await receiptsWhere("r.mint = $1", [coin.mint]);
  const mint = new PublicKey(coin.mint);
  const cfg = pda.sharingConfig(mint).toBase58();
  const platformBps = env.platformBps;

  return (
    <section>
      <div className="row" style={{ gap: 18, marginTop: 30 }}>
        {coin.image_uri ? <img className="coin-img" style={{ width: 84, height: 84, borderRadius: 22 }} src={coin.image_uri} alt="" /> : null}
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>${coin.symbol}</h1>
          <div className="muted" style={{ fontWeight: 600 }}>{coin.name}</div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h2>The cut goes to</h2>
          <Link href={playerPath(coin.channel_id)} className="channel" style={{ textDecoration: "none", color: "var(--text)" }}>
            {coin.avatar_url ? <img src={coin.avatar_url} alt="" /> : <div className="avatar">{String(coin.title).slice(0, 1).toUpperCase()}</div>}
            <div><div className="t">{coin.title}</div><div className="muted small">{PLATFORM_LABEL[splitPlayerId(coin.channel_id)!.platform]} · {coin.handle}</div></div>
          </Link>
          <div style={{ marginTop: 16 }}>
            {live.ok ? (
              <span className="pill ok">Route verified on-chain · locked</span>
            ) : (
              <span className="pill bad">Not routed: {live.reason}</span>
            )}
          </div>
          <table style={{ marginTop: 16 }}>
            <tbody>
              <tr><td className="muted">Credited to the player</td><td>{lamportsToSol(sums.routed)} SOL</td></tr>
              <tr><td className="muted">Waiting in vault</td><td>{lamportsToSol(coin.vault_waiting_lamports)} SOL</td></tr>
              <tr><td className="muted">Player share</td><td>{(10_000 - platformBps) / 100}%</td></tr>
              {platformBps > 0 && <tr><td className="muted">Site share</td><td>{platformBps / 100}%</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Check it yourself</h2>
          <table>
            <tbody>
              <tr><td className="muted">Mint</td><td className="mono">{coin.mint}</td></tr>
              <tr><td className="muted">Fee sharing config</td><td className="mono"><a href={`https://solscan.io/account/${cfg}`} target="_blank" rel="noreferrer">{cfg}</a></td></tr>
              <tr><td className="muted">Treasury</td><td className="mono">{treasury().publicKey.toBase58()}</td></tr>
              {platformWallet() && <tr><td className="muted">Site wallet</td><td className="mono">{platformWallet()!.toBase58()}</td></tr>}
              <tr><td className="muted">Launched by</td><td className="mono">{coin.launcher}</td></tr>
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn" href={`https://pump.fun/coin/${coin.mint}`} target="_blank" rel="noreferrer">Trade on pump.fun</a>
            <a className="btn ghost" href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer">Solscan</a>
          </div>
        </div>
      </div>

      <section>
        <h2>Receipts</h2>
        <Receipts rows={receipts} showChannel={false} />
      </section>
      <p className="muted small">
        This coin was launched by a fan. {coin.title} did not create, endorse or promote it, and it is not affiliated with Rockstar Games or Take-Two.
      </p>
    </section>
  );
}
