import "server-only";
// The one file that talks to pump.fun's SDK. Method names and arguments follow
// pump.fun's public docs (github.com/pump-fun/pump-public-docs, CREATOR_FEE_SHARING.md
// and COIN_CREATION.md). If a future SDK version renames something, fix it here only.
import { PUMP_SDK } from "@pump-fun/pump-sdk";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { connection, launchSplit, pda, ammCreatorVaultAta } from "./solana";
import { decodeBondingCurve, decodeSharingConfig, routeProblem, type SharingConfig } from "./layouts";

const sdk: any = PUMP_SDK;

const asList = (x: TransactionInstruction | TransactionInstruction[]) => (Array.isArray(x) ? x : [x]);

export async function createCoinIxs(a: {
  mint: PublicKey;
  launcher: PublicKey;
  name: string;
  symbol: string;
  uri: string;
}): Promise<TransactionInstruction[]> {
  return asList(
    await sdk.createV2Instruction({
      mint: a.mint,
      name: a.name,
      symbol: a.symbol,
      uri: a.uri,
      creator: a.launcher, // must be the launcher: only the creator may opt the coin into fee sharing
      user: a.launcher,
      mayhemMode: false,
      holderReward: false,
    }),
  );
}

/**
 * create_fee_sharing_config + update_fee_shares_v2 in one transaction. update_fee_shares_v2
 * also revokes the admin, so once this lands the split can never be changed by anyone.
 */
export async function routeFeesIxs(a: { mint: PublicKey; launcher: PublicKey }): Promise<TransactionInstruction[]> {
  const createCfg = asList(await sdk.createFeeSharingConfig({ creator: a.launcher, mint: a.mint, pool: null }));
  const update = asList(
    await sdk.updateFeeSharesV2({
      authority: a.launcher,
      mint: a.mint,
      currentShareholders: [a.launcher],
      newShareholders: launchSplit().map((s) => ({ address: new PublicKey(s.address), shareBps: s.shareBps })),
      quoteMint: NATIVE_MINT,
      quoteTokenProgram: TOKEN_PROGRAM_ID,
    }),
  );
  return [...createCfg, ...update];
}

export type RouteState =
  | { ok: true; config: SharingConfig; graduated: boolean }
  | { ok: false; reason: string };

/** Reads the coin's bonding curve and fee sharing config from chain and checks our split. */
export async function readRoute(mint: PublicKey): Promise<RouteState> {
  const cfgAddr = pda.sharingConfig(mint);
  const [bcInfo, cfgInfo] = await connection().getMultipleAccountsInfo([pda.bondingCurve(mint), cfgAddr]);
  if (!bcInfo) return { ok: false, reason: "coin not found" };
  if (!cfgInfo) return { ok: false, reason: "no fee sharing config" };
  const bc = decodeBondingCurve(bcInfo.data);
  if (!new PublicKey(bc.creator).equals(cfgAddr)) return { ok: false, reason: "creator fees do not point at the sharing config" };
  const config = decodeSharingConfig(cfgInfo.data);
  const problem = routeProblem(config, launchSplit());
  return problem ? { ok: false, reason: problem } : { ok: true, config, graduated: bc.complete };
}

const RENT_EXEMPT_EMPTY = 890_880n; // lamports a 0-byte system account keeps

/** Fees waiting to be pushed: bonding-curve vault (minus its rent) + AMM vault after graduation. */
export async function waitingLamports(mint: PublicKey, graduated: boolean): Promise<{ curve: bigint; amm: bigint }> {
  const cfg = pda.sharingConfig(mint);
  const vault = pda.creatorVault(cfg);
  const bal = BigInt(await connection().getBalance(vault));
  const curve = bal > RENT_EXEMPT_EMPTY ? bal - RENT_EXEMPT_EMPTY : 0n;
  let amm = 0n;
  if (graduated) {
    try {
      const t = await connection().getTokenAccountBalance(ammCreatorVaultAta(cfg));
      amm = BigInt(t.value.amount);
    } catch {
      amm = 0n; // AMM vault not created yet
    }
  }
  return { curve, amm };
}

export async function pushIxs(a: { mint: PublicKey; payer: PublicKey; includeAmm: boolean }) {
  const ixs: TransactionInstruction[] = [];
  if (a.includeAmm) {
    ixs.push(
      ...asList(
        await sdk.transferCreatorFeesToPumpV2({
          payer: a.payer,
          mint: a.mint,
          quoteMint: NATIVE_MINT,
          quoteTokenProgram: TOKEN_PROGRAM_ID,
        }),
      ),
    );
  }
  // Hand the SDK its own decoded config so shareholder order is exactly what the program expects.
  const cfgAddr = pda.sharingConfig(a.mint);
  const info = await connection().getAccountInfo(cfgAddr);
  if (!info) throw new Error("sharing config vanished");
  ixs.push(
    ...asList(
      await sdk.distributeCreatorFeesV2({
        mint: a.mint,
        sharingConfig: sdk.decodeSharingConfig(info),
        sharingConfigAddress: cfgAddr,
        quoteMint: NATIVE_MINT,
        payer: a.payer,
        shouldInitializeAta: false,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
      }),
    ),
  );
  return ixs;
}
