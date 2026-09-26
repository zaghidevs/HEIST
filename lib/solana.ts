import "server-only";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";
import { env } from "./env";
import { expectedSplit, type ExpectedShare } from "./layouts";

export const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_FEES_PROGRAM = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
export const PUMP_AMM_PROGRAM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");

let _conn: Connection | undefined;
export function connection(): Connection {
  return (_conn ??= new Connection(env.rpcUrl, "confirmed"));
}

function keypairFrom(secret: string, name: string): Keypair {
  try {
    const s = secret.trim();
    const bytes = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s);
    return Keypair.fromSecretKey(bytes);
  } catch {
    throw new Error(`${name} is not a valid Solana secret key`);
  }
}

let _treasury: Keypair | undefined;
let _crank: Keypair | undefined;
export const treasury = () => (_treasury ??= keypairFrom(env.treasurySecret, "TREASURY_SECRET_KEY"));
export const crank = () => (_crank ??= keypairFrom(env.crankSecret, "CRANK_SECRET_KEY"));

export function platformWallet(): PublicKey | null {
  return env.platformBps > 0 && env.platformWallet ? new PublicKey(env.platformWallet) : null;
}

/** The exact split every launch writes on-chain, and every route check compares against. */
export function launchSplit(): ExpectedShare[] {
  return expectedSplit(treasury().publicKey.toBytes(), platformWallet()?.toBytes() ?? null, env.platformBps);
}

export const pda = {
  bondingCurve: (mint: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), mint.toBuffer()], PUMP_PROGRAM)[0],
  sharingConfig: (mint: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("sharing-config"), mint.toBuffer()], PUMP_FEES_PROGRAM)[0],
  creatorVault: (creator: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("creator-vault"), creator.toBuffer()], PUMP_PROGRAM)[0],
  ammCreatorVaultAuthority: (creator: PublicKey) =>
    PublicKey.findProgramAddressSync([Buffer.from("creator_vault"), creator.toBuffer()], PUMP_AMM_PROGRAM)[0],
};

export function ammCreatorVaultAta(creator: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(NATIVE_MINT, pda.ammCreatorVaultAuthority(creator), true, TOKEN_PROGRAM_ID);
}

export function isValidPubkey(s: string): boolean {
  try {
    return PublicKey.isOnCurve(new PublicKey(s).toBytes());
  } catch {
    return false;
  }
}

/** SOL/USD at the moment a receipt is written. Best effort: null if the price API is down. */
export async function solUsd(): Promise<number | null> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" });
    const j = await r.json();
    const p = Number(j?.solana?.usd);
    return isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}
