// Alternative to an external cron: keeps calling the crank endpoint every 90 seconds.
// Run it anywhere that stays on (a $5 VPS, Railway worker, your own PC):  npm run crank
import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const base = process.env.CRANK_TARGET_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) throw new Error("Set CRON_SECRET");

async function tick() {
  try {
    const r = await fetch(`${base}/api/cron/crank`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    console.log(new Date().toISOString(), r.status, await r.text());
  } catch (e) {
    console.error(new Date().toISOString(), "crank call failed:", e.message);
  }
}
await tick();
setInterval(tick, 90_000);
