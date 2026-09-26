import Link from "next/link";
import Countdown from "@/components/Countdown";
import LaunchForm from "@/components/LaunchForm";
import { enabledPlatforms } from "@/lib/enabled";
import { lamportsToSol } from "@/lib/format";
import { playerPath } from "@/lib/players-parse";
import { leaderboard, recentCoins, siteStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, coins, board] = await Promise.all([siteStats(), recentCoins(8), leaderboard(8)]);
  const platformBps = Number(process.env.PLATFORM_FEE_BPS || "0");
  return (
    <>
      <section className="hero">
        <Countdown />
        <h1><span className="ln">Every trade</span><span className="ln">is a HEIST.</span></h1>
        <p className="lead" style={{ margin: "0 auto 30px" }}>
          Launch a coin for any <b>GTA player or RP streamer</b>. Every trade's creator fee goes straight into <b>their cut</b>,
          locked on-chain the second the coin goes live.
        </p>
        <div className="chain"><span>Pick a player</span><i /><span>Launch the coin</span><i /><span>Every trade pays</span><i /><span className="on">They take the cut</span></div>
      </section>

      <section className="launch-home" id="launch">
        <div className="launch-head">
          <h2>Plan the <em>heist.</em></h2>
          <p className="sub" style={{ marginBottom: 0 }}>A normal pump.fun coin. Its creator fees go to the player you pick, forever.</p>
        </div>
        <LaunchForm platformBps={platformBps} enabled={enabledPlatforms()} />
      </section>

      <section className="totals glass" aria-label="HEIST totals">
        <div><div className="v">{lamportsToSol(stats.routed, 2)} SOL</div><div className="k">sent to players' cuts</div></div>
        <div><div className="v">{lamportsToSol(stats.withdrawn, 2)} SOL</div><div className="k">paid out</div></div>
        <div><div className="v">{stats.coins}</div><div className="k">coins live</div></div>
        <div><div className="v">{stats.channels}</div><div className="k">players with a cut</div></div>
      </section>

      <section className="grid two">
        <div className="card list">
          <h2>Biggest cuts</h2>
          {board.length === 0 && <div className="empty"><b>No cuts yet</b><span>Launch the first coin and a player gets paid from the first trade.</span></div>}
          {board.map((b) => (
            <Link key={b.channel_id} href={playerPath(b.channel_id)} className="item">
              {b.avatar_url ? <img className="avatar" src={b.avatar_url} alt="" /> : <div className="avatar">{String(b.title).slice(0, 1).toUpperCase()}</div>}
              <div><div className="t">{b.title}</div><div className="muted small">{b.claimed_at ? "verified" : "waiting to claim"}</div></div>
              <div className="right">{lamportsToSol(b.credited, 3)} SOL</div>
            </Link>
          ))}
        </div>
        <div className="card list">
          <h2>New coins</h2>
          {coins.length === 0 && <div className="empty"><b>No coins yet</b><span>The first HEIST coin shows up here.</span></div>}
          {coins.map((c) => (
            <Link key={c.mint} href={`/coin/${c.mint}`} className="item">
              {c.image_uri ? <img className="coin-img" src={c.image_uri} alt="" /> : <div className="coin-img" />}
              <div><div className="t">${c.symbol} <span className="muted small">{c.name}</span></div><div className="muted small">for {c.channel_title}</div></div>
              <div className="right">
                <span className={`pill ${c.route_status === "routed" ? "ok" : c.route_status === "pending" ? "warn" : "bad"}`}>
                  {c.route_status === "routed" ? "locked" : c.route_status === "pending" ? "checking" : "not routed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="sec center">
        <h2>How the <em>job works.</em></h2>
        <p className="sub">The route for the fees is written into pump.fun's own fee program at launch and locked. Nobody can change it afterwards, including us.</p>
        <div className="flow">
          <div className="step glass"><div className="n">1</div><h3>Pick a player</h3><p>Any GTA player by their Social Club name, or any RP streamer by their Twitch or Kick channel.</p></div>
          <div className="step glass"><div className="n">2</div><h3>Every trade pays</h3><p>Each buy and sell pays a creator fee. On a HEIST coin, it flows into that player's cut.</p></div>
          <div className="step glass"><div className="n">3</div><h3>They take the cut</h3><p>The player proves the account is theirs and withdraws in SOL. Every fee and payout gets a public receipt.</p></div>
        </div>
      </section>
    </>
  );
}
