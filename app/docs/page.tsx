import { env } from "@/lib/env";
import { PUMP_AMM_PROGRAM, PUMP_FEES_PROGRAM, PUMP_PROGRAM, platformWallet, treasury } from "@/lib/solana";

export const metadata = { title: "Docs" };
export const dynamic = "force-dynamic";

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="card table-wrap" style={{ padding: "6px 18px" }}>
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><td className="muted" style={{ width: "34%" }}>{k}</td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Docs() {
  const site = env.siteName;
  const bps = env.platformBps;
  const pw = platformWallet();
  const tre = treasury().publicKey.toBase58();
  const playerPct = (10_000 - bps) / 100;
  const split = bps > 0 ? `${playerPct}% to the player's cut and ${bps / 100}% to ${site}` : "100% to the player's cut";

  const faq: [string, React.ReactNode][] = [
    ["Who can get a cut?", "Any GTA player with a Rockstar Social Club name, or any GTA roleplay streamer with a Twitch or Kick channel. They don't need to sign up first."],
    ["Does the player have to know about the coin?", "No. Their cut builds up in their name whether or not they've heard of us, and waits until they prove the account is theirs."],
    ["Can the launcher take the fees back?", "No. The second launch transaction locks the split on-chain by revoking the admin. Nobody can change it after that, including us."],
    ["Do players give you access to their account?", "No. Twitch and Kick streamers paste a one-time code into their public bio, which we read through the platform's public API. Social Club players send the code with a screenshot to our X account and we check it by hand. No passwords, no permissions."],
    ["Is the player endorsing the coin?", "No. Coins are launched by fans. Every coin's description and page say it isn't made or endorsed by the player."],
    ["What if a player doesn't want this?", "After verifying, they can switch off new coins in their name. We also hide coins that impersonate someone, on request."],
    ["Is this made by Rockstar?", `No. ${site} is independent and not affiliated with, endorsed by or sponsored by Rockstar Games, Take-Two Interactive, Twitch, Kick or pump.fun. Grand Theft Auto and GTA are trademarks of Take-Two Interactive.`],
  ];

  return (
    <section className="docs">
      <div className="center">
        <h1 className="page-title">The playbook.</h1>
        <p className="lead">Everything about how {site} coins pay GTA players and RP streamers.</p>
      </div>

      <h3>The rule</h3>
      <p>Every coin launched on {site} is tied to one player. All of its pump.fun creator fees ({split}) go to that player's cut.</p>

      <h3>Launching</h3>
      <ol>
        <li>Pick the player: a Social Club name, or a Twitch or Kick channel.</li>
        <li>Name the coin, add an image, and sign twice with Phantom. The first transaction creates a normal pump.fun coin.</li>
        <li>The second calls pump.fun's own fee program to route the creator fees and <b>locks that split forever</b>.</li>
      </ol>

      <h3>How players get paid</h3>
      <ol>
        <li>Fees build up in the coin's pump.fun vault with every trade.</li>
        <li>Every couple of minutes they're collected into the treasury and credited to the player's cut, with a public receipt.</li>
        <li>The player proves the account is theirs on <a href="/claim">Get paid</a> and withdraws in SOL to any wallet. {site} pays the network fee.</li>
      </ol>

      <h3>Who holds the SOL</h3>
      <p>
        Between being collected and being withdrawn, a player's cut sits in the treasury, a normal Solana wallet whose key
        our server holds. {site} is custodial because pump.fun can't pay a Social Club or Twitch account directly. The{" "}
        <a href="/payments">Payouts</a> page shows everything owed next to the treasury's live balance.
      </p>

      <h3>Verify it yourself</h3>
      <Kv rows={[
        ["Pump program", <span key="a" className="mono">{PUMP_PROGRAM.toBase58()}</span>],
        ["Fee program", <span key="b" className="mono">{PUMP_FEES_PROGRAM.toBase58()}</span>],
        ["PumpSwap program", <span key="c" className="mono">{PUMP_AMM_PROGRAM.toBase58()}</span>],
        ["Treasury", <span key="d" className="mono">{tre}</span>],
        ...(pw ? ([[`${site} wallet (${bps / 100}%)`, <span key="e" className="mono">{pw.toBase58()}</span>]] as [string, React.ReactNode][]) : []),
        ["Fee config", <span key="f">PDA of <span className="mono">["sharing-config", mint]</span> under the fee program, with <span className="mono">admin_revoked = true</span></span>],
      ]} />

      <h3>FAQ</h3>
      {faq.map(([q, a]) => (
        <details key={q} className="glass"><summary>{q}</summary><p className="muted">{a}</p></details>
      ))}

      <p className="muted small" style={{ marginTop: 40 }}>
        Memecoins are extremely risky and most lose all their value. A player's cut depends on trading that can stop at any
        time. Nothing here is financial advice.
      </p>
    </section>
  );
}
