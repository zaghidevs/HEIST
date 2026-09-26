"use client";
import { useState } from "react";

type Row = { code: string; name: string; approved: boolean; created: string };

export default function AdminApprovals({ adminKey, rows }: { adminKey: string; rows: Row[] }) {
  const [list, setList] = useState(rows);
  const [err, setErr] = useState<string | null>(null);

  async function act(code: string, approve: boolean) {
    setErr(null);
    const r = await fetch("/api/admin/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: adminKey, code, approve }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error || "Failed");
    setList((l) => (approve ? l.map((x) => (x.code === code ? { ...x, approved: true } : x)) : l.filter((x) => x.code !== code)));
  }

  return (
    <div className="card glass">
      {err && <div className="notice err">{err}</div>}
      {list.length === 0 && <p className="muted">No requests right now.</p>}
      <table>
        <thead><tr><th>Player</th><th>Code</th><th>Asked</th><th></th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.code}>
              <td>{r.name}</td>
              <td className="mono">{r.code}</td>
              <td className="muted small">{new Date(r.created).toLocaleString()}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                {r.approved ? <span className="pill ok">approved</span> : (
                  <>
                    <button className="btn small" onClick={() => act(r.code, true)}>Approve</button>{" "}
                    <button className="btn clear small" onClick={() => act(r.code, false)}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
