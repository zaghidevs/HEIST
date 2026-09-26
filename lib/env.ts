import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

export const env = {
  get databaseUrl() { return req("DATABASE_URL"); },
  get rpcUrl() { return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"; },
  get treasurySecret() { return req("TREASURY_SECRET_KEY"); },
  get crankSecret() { return req("CRANK_SECRET_KEY"); },
  get twitchClientId() { return req("TWITCH_CLIENT_ID"); },
  get twitchClientSecret() { return req("TWITCH_CLIENT_SECRET"); },
  get kickClientId() { return req("KICK_CLIENT_ID"); },
  get kickClientSecret() { return req("KICK_CLIENT_SECRET"); },
  get adminKey() { return req("ADMIN_KEY"); },
  get sessionSecret() { return req("SESSION_SECRET"); },
  get cronSecret() { return req("CRON_SECRET"); },
  get platformBps() { return Number(process.env.PLATFORM_FEE_BPS || "0"); },
  get platformWallet() { return process.env.PLATFORM_WALLET || ""; },
  get siteName() { return process.env.NEXT_PUBLIC_SITE_NAME || "HEIST"; },
  get siteUrl() { return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"; },
};
