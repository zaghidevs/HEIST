import Link from "next/link";
import { lamportsToSol, receiptNo, shortKey, usd } from "@/lib/format";
import { playerPath } from "@/lib/players-parse";

const STATUS: Record<string, [string, string]> = {
  sent: ["ok", "sent"],
  pending: ["warn", "confirming"],
  held: ["bad", "held"],
};

export default function Receipts({ rows, showChannel = true }: { rows: any[]; showChannel?: boolean }) {
  if (rows.length === 0) return <div className="empty"><b>No receipts yet</b><span>The first one appears a few minutes after the first HEIST coin trades.</span></div>;
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Receipt</th>
            <th>What</th>
            {showChannel && <th>Player</th>}
            <th>SOL</th>
            <th>Status</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const [cls, label] = STATUS[r.status] ?? ["", r.status];
            const dollars = usd(r.lamports, r.sol_usd == null ? null : Number(r.sol_usd));
            return (
              <tr key={r.seq}>
                <td className="mono">{receiptNo(r.seq)}</td>
                <td>
                  {r.kind === "push" ? (
                    <>Cut from <Link href={`/coin/${r.mint}`}>${r.symbol}</Link></>
                  ) : (
                    <>Withdrawn to <span className="mono">{shortKey(r.destination)}</span></>
                  )}
                  <div className="muted small">{new Date(r.created_at).toLocaleString()}</div>
                </td>
                {showChannel && <td><Link href={playerPath(r.channel_id)}>{r.channel_title}</Link></td>}
                <td>
                  {r.status === "pending" && r.kind === "push" ? "…" : lamportsToSol(r.lamports)}
                  {dollars && <div className="muted small">{dollars}</div>}
                </td>
                <td><span className={`pill ${cls}`}>{label}</span>{r.note && <div className="muted small">{r.note}</div>}</td>
                <td>{r.signature && <a className="mono" href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer">{shortKey(r.signature, 5)}</a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
