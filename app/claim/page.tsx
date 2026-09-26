import Link from "next/link";
import ClaimPanel from "@/components/ClaimPanel";
import CreatorDashboard from "@/components/CreatorDashboard";
import Receipts from "@/components/Receipts";
import { q } from "@/lib/db";
import { enabledPlatforms } from "@/lib/enabled";
import { lamportsToSol } from "@/lib/format";
import { balanceOf } from "@/lib/ledger";
import { playerPath } from "@/lib/players-parse";
import { receiptsWhere } from "@/lib/queries";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get paid" };

export default async function ClaimPage() {
  const s = currentSession();
  if (!s) {
    return (
      <section className="launch-home" style={{ marginTop: 20 }}>
        <div className="launch-head">
          <h1 className="page-title" style={{ marginTop: 20 }}>Take your cut.</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Fans launched coins in your name? Prove the account is yours with a one-time code, then withdraw your cut in
            SOL to any wallet. No password, no access to your account.
          </p>
        </div>
        <ClaimPanel enabled={enabledPlatforms()} />
      </section>
    );
  }
  const [ch] = await q(`SELECT * FROM channels WHERE channel_id=$1`, [s.channelId]);
  const bal = await balanceOf(s.channelId);
  const receipts = await receiptsWhere("r.channel_id = $1", [s.channelId]);
  return (
    <section>
      <h1 className="page-title">Hi, {ch?.title}.</h1>
      <p className="lead">
        Your cut so far: {lamportsToSol(bal.credited)} SOL. <Link href={playerPath(s.channelId)}>Public page →</Link>
      </p>
      <CreatorDashboard claimable={bal.claimable.toString()} claimableSol={lamportsToSol(bal.claimable)} blocked={!!ch?.launches_blocked} />
      <section>
        <h2>Your receipts</h2>
        <Receipts rows={receipts} showChannel={false} />
      </section>
    </section>
  );
}
