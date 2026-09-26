import Receipts from "@/components/Receipts";
import { lamportsToSol } from "@/lib/format";
import { totalLiabilities } from "@/lib/ledger";
import { receiptsWhere } from "@/lib/queries";
import { connection, treasury } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

export default async function Payments() {
  const [rows, owed] = await Promise.all([receiptsWhere("", [], 200), totalLiabilities()]);
  let held: bigint | null = null;
  try {
    held = BigInt(await connection().getBalance(treasury().publicKey));
  } catch {}
  return (
    <section>
      <h1 className="page-title">Every cut, on record.</h1>
      <p className="lead">Numbered, permanent receipts for every fee collected and every payout. Each links its Solana transaction.</p>
      <div className="grid two" style={{ margin: "20px 0" }}>
        <div className="card stat"><div className="v">{lamportsToSol(owed)} SOL</div><div className="k">owed to players (sum of all cuts)</div></div>
        <div className="card stat">
          <div className="v">{held == null ? "—" : lamportsToSol(held) + " SOL"}</div>
          <div className="k">in the treasury <span className="mono">{treasury().publicKey.toBase58()}</span></div>
        </div>
      </div>
      <Receipts rows={rows} />
    </section>
  );
}
