import Link from "next/link";
import { notFound } from "next/navigation";
import Receipts from "@/components/Receipts";
import { q } from "@/lib/db";
import { lamportsToSol } from "@/lib/format";
import { balanceOf } from "@/lib/ledger";
import { isPlatform, PLATFORM_LABEL, playerId, profileUrl } from "@/lib/players-parse";
import { receiptsWhere } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: { platform: string; name: string } }) {
  if (!isPlatform(params.platform)) notFound();
  const id = playerId(params.platform, decodeURIComponent(params.name).toLowerCase());
  const [ch] = await q(`SELECT * FROM channels WHERE channel_id=$1`, [id]);
  if (!ch) notFound();
  const [bal, coins, receipts] = await Promise.all([
    balanceOf(id),
    q(`SELECT * FROM coins WHERE channel_id=$1 ORDER BY created_at DESC`, [id]),
    receiptsWhere("r.channel_id = $1", [id]),
  ]);
  const link = profileUrl(id);

  return (
    <section>
      <div className="channel" style={{ marginTop: 30 }}>
        {ch.avatar_url ? <img src={ch.avatar_url} alt="" style={{ width: 84, height: 84, borderRadius: 22 }} /> : <div className="avatar" style={{ width: 84, height: 84, borderRadius: 22, fontSize: 34 }}>{String(ch.title).slice(0, 1).toUpperCase()}</div>}
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{ch.title}</h1>
          {link && <a className="muted" href={link} target="_blank" rel="noreferrer">{PLATFORM_LABEL[ch.platform as keyof typeof PLATFORM_LABEL]} · {ch.handle}</a>}
        </div>
      </div>

      <div className="grid three" style={{ marginTop: 24 }}>
        <div className="card stat"><div className="v">{lamportsToSol(bal.credited)} SOL</div><div className="k">cut from {coins.length} coin{coins.length === 1 ? "" : "s"}</div></div>
        <div className="card stat"><div className="v">{lamportsToSol(bal.claimable)} SOL</div><div className="k">waiting to be withdrawn</div></div>
        <div className="card stat"><div className="v">{lamportsToSol(bal.withdrawn)} SOL</div><div className="k">withdrawn</div></div>
      </div>

      {!ch.claimed_at && (
        <div className="card" style={{ marginTop: 16 }}>
          <b>Is this you?</b> Prove the account is yours and withdraw your cut to any Solana wallet. <Link href="/claim">Get paid →</Link>
        </div>
      )}
      {ch.launches_blocked && <div className="notice info">This player has turned off new coins in their name.</div>}

      <section className="card list">
        <h2>Coins</h2>
        {coins.length === 0 && <p className="muted">No coins yet.</p>}
        {coins.map((c) => (
          <Link key={c.mint} href={`/coin/${c.mint}`} className="item">
            {c.image_uri ? <img className="coin-img" src={c.image_uri} alt="" /> : <div className="coin-img" />}
            <div><div className="t">${c.symbol}</div><div className="muted small">{c.name}</div></div>
            <div className="right">
              <span className={`pill ${c.route_status === "routed" ? "ok" : "bad"}`}>{c.route_status === "routed" ? "locked" : "not routed"}</span>
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2>Receipts</h2>
        <Receipts rows={receipts} showChannel={false} />
      </section>
    </section>
  );
}
