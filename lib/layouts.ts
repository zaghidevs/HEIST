// Decoders for the two on-chain accounts we check, straight from pump.fun's published IDLs.
// Dependency-free so they can be unit tested; pubkeys come back as raw 32-byte arrays.

const SHARING_CONFIG_DISC = [216, 74, 9, 0, 56, 140, 93, 75];
const BONDING_CURVE_DISC = [23, 183, 248, 55, 96, 216, 172, 96];

export type Shareholder = { address: Uint8Array; shareBps: number };
export type SharingConfig = {
  bump: number;
  version: number;
  status: "Paused" | "Active";
  mint: Uint8Array;
  admin: Uint8Array;
  adminRevoked: boolean;
  shareholders: Shareholder[];
};
export type BondingCurve = {
  virtualTokenReserves: bigint;
  virtualQuoteReserves: bigint;
  realTokenReserves: bigint;
  realQuoteReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
  creator: Uint8Array;
};

function checkDisc(data: Uint8Array, disc: number[], what: string) {
  if (data.length < 8 || disc.some((b, i) => data[i] !== b)) throw new Error(`not a ${what} account`);
}

function reader(data: Uint8Array, start: number) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = start;
  return {
    u8: () => data[o++],
    bool: () => data[o++] === 1,
    u16: () => { const v = view.getUint16(o, true); o += 2; return v; },
    u32: () => { const v = view.getUint32(o, true); o += 4; return v; },
    u64: () => { const v = view.getBigUint64(o, true); o += 8; return v; },
    key: () => { const k = data.slice(o, o + 32); o += 32; if (k.length !== 32) throw new Error("truncated"); return k; },
  };
}

export function decodeSharingConfig(data: Uint8Array): SharingConfig {
  checkDisc(data, SHARING_CONFIG_DISC, "SharingConfig");
  const r = reader(data, 8);
  const bump = r.u8();
  const version = r.u8();
  const statusByte = r.u8();
  const mint = r.key();
  const admin = r.key();
  const adminRevoked = r.bool();
  const n = r.u32();
  if (n > 10) throw new Error("too many shareholders");
  const shareholders: Shareholder[] = [];
  for (let i = 0; i < n; i++) shareholders.push({ address: r.key(), shareBps: r.u16() });
  return { bump, version, status: statusByte === 1 ? "Active" : "Paused", mint, admin, adminRevoked, shareholders };
}

export function decodeBondingCurve(data: Uint8Array): BondingCurve {
  checkDisc(data, BONDING_CURVE_DISC, "BondingCurve");
  const r = reader(data, 8);
  return {
    virtualTokenReserves: r.u64(),
    virtualQuoteReserves: r.u64(),
    realTokenReserves: r.u64(),
    realQuoteReserves: r.u64(),
    tokenTotalSupply: r.u64(),
    complete: r.bool(),
    creator: r.key(),
  };
}

export const bytesEqual = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

export type ExpectedShare = { address: Uint8Array; shareBps: number };

/**
 * Our route is valid only if the split is exactly what we set at launch (same holders,
 * same bps, same order), the config is active, and nobody can change it any more.
 */
export function routeProblem(cfg: SharingConfig, expected: ExpectedShare[]): string | null {
  if (cfg.status !== "Active") return "fee sharing is paused";
  if (!cfg.adminRevoked) return "split can still be changed by the launcher";
  if (cfg.shareholders.length !== expected.length) return "unexpected shareholders";
  for (let i = 0; i < expected.length; i++) {
    const got = cfg.shareholders[i];
    if (!bytesEqual(got.address, expected[i].address) || got.shareBps !== expected[i].shareBps)
      return "unexpected shareholders";
  }
  return null;
}

/** The on-chain split for a launch: optional platform cut first, treasury gets the rest. */
export function expectedSplit(treasury: Uint8Array, platform: Uint8Array | null, platformBps: number): ExpectedShare[] {
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps > 2000) throw new Error("PLATFORM_FEE_BPS must be 0..2000");
  if (platformBps === 0 || !platform) return [{ address: treasury, shareBps: 10_000 }];
  if (bytesEqual(platform, treasury)) throw new Error("PLATFORM_WALLET must differ from the treasury");
  return [
    { address: platform, shareBps: platformBps },
    { address: treasury, shareBps: 10_000 - platformBps },
  ];
}
