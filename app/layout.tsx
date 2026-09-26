import type { Metadata } from "next";
import Link from "next/link";
import { Figtree, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import NavWallet from "@/components/NavWallet";
import RailNav from "@/components/RailNav";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-figtree", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap" });

const site = process.env.NEXT_PUBLIC_SITE_NAME || "HEIST";
const X_URL = "https://x.com/heistlaunchpad";

export const metadata: Metadata = {
  title: { default: `${site} · Every trade is a HEIST`, template: `%s · ${site}` },
  description: "Launch a coin for any GTA player or RP streamer. Every trade's pump.fun creator fee goes to their cut, locked on-chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${mono.variable}`}>
      <body>
        <div className="sky" aria-hidden><div className="art" /><div className="scrim" /></div>
        <Providers>
          <aside className="rail glass" aria-label="Main">
            <Link href="/" className="brand" aria-label={`${site} home`}><img src="/logo.png" alt={site} width={176} height={77} /></Link>
            <RailNav />
            <div className="rail-foot">
              <a className="visit" href={X_URL} target="_blank" rel="noreferrer" aria-label={`Visit ${site} on X`}><span>Visit</span><img src="/x.png" alt="" width={30} height={31} /></a>
            </div>
          </aside>

          <header className="mtop">
            <Link href="/" className="brand" aria-label={`${site} home`}><img src="/logo.png" alt={site} width={110} height={48} /></Link>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <a className="visit" href={X_URL} target="_blank" rel="noreferrer" aria-label={`${site} on X`}><span>Visit</span><img src="/x.png" alt="" width={26} height={27} /></a>
              <NavWallet />
            </div>
          </header>
          <div className="topbar"><NavWallet /></div>

          <div className="shell">
            <main className="wrap">{children}</main>
            <footer>
              <div className="wrap">
                {site} is an independent project, not affiliated with, endorsed by or sponsored by Rockstar Games, Take-Two
                Interactive, Twitch, Kick or pump.fun, or by any player named on this site. Grand Theft Auto and GTA are
                trademarks of Take-Two Interactive. Coins are launched by fans; a player appearing here does not mean they
                support a coin. Memecoins are highly speculative and most go to zero. Nothing here is financial advice.
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
