import { notFound } from "next/navigation";
import AdminApprovals from "@/components/AdminApprovals";
import { adminKeyOk } from "@/lib/admin";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false } };

// Open as /admin?key=YOUR_ADMIN_KEY. Lists Social Club ownership requests waiting for a manual check.
export default async function AdminPage({ searchParams }: { searchParams: { key?: string } }) {
  if (!adminKeyOk(searchParams.key)) notFound();
  const rows = await q(
    `SELECT cc.code, cc.channel_id, cc.approved_at, cc.created_at, cc.expires_at, c.title
     FROM claim_codes cc JOIN channels c USING (channel_id)
     WHERE c.platform='sc' AND cc.expires_at > now() ORDER BY cc.created_at DESC LIMIT 200`,
  );
  return (
    <section className="page">
      <h1 className="page-title">Social Club requests</h1>
      <p className="lead">
        Approve a code only after the player DMs the HEIST X account the code plus a screenshot of themselves logged in
        to that Social Club profile. Approving lets whoever holds the code withdraw that player's cut.
      </p>
      <AdminApprovals adminKey={searchParams.key!} rows={rows.map((r) => ({ code: r.code, name: r.title, approved: !!r.approved_at, created: new Date(r.created_at).toISOString() }))} />
    </section>
  );
}
