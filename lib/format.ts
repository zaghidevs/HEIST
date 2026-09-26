// Display helpers (pure).
export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function lamportsToSol(l: bigint | number | string, digits = 4): string {
  const v = BigInt(l);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / LAMPORTS_PER_SOL;
  const frac = (a % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, digits);
  return `${neg ? "-" : ""}${whole}${digits > 0 ? "." + frac : ""}`;
}

export function receiptNo(seq: number | string | bigint): string {
  return "HS-" + String(seq).padStart(6, "0");
}

export function usd(lamports: bigint | number | string, solUsd: number | null | undefined): string | null {
  if (solUsd == null || !isFinite(solUsd)) return null;
  const v = (Number(BigInt(lamports)) / 1e9) * solUsd;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function shortKey(k: string, n = 4): string {
  return k.length <= n * 2 + 1 ? k : `${k.slice(0, n)}…${k.slice(-n)}`;
}

/** Validates the coin fields the same way pump.fun's create_v2 does. */
export function validateCoinFields(name: string, symbol: string): string | null {
  if (!name.trim()) return "Name is required";
  if ([...name].length > 32) return "Name must be 32 characters or fewer";
  if (!symbol.trim()) return "Ticker is required";
  if ([...symbol].length > 13) return "Ticker must be 13 characters or fewer";
  if (!/^[A-Za-z0-9$._-]+$/.test(symbol)) return "Ticker can use letters, numbers and $ . _ - only";
  return null;
}
