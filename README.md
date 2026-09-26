# HEIST

Launch a coin for any GTA player or RP streamer. Every trade's pump.fun creator fee goes to their cut.

- Next.js 14 (App Router) + Postgres (Neon) + Solana (pump.fun fee sharing).
- Recipients: Rockstar Social Club names (ownership checked by hand at `/admin?key=ADMIN_KEY`),
  Twitch channels (bio code via the Twitch API) and Kick channels (bio code via the Kick API).
  Twitch and Kick switch on automatically when their keys are set.
- Fees are pushed into the treasury by `/api/cron/crank` (call it every minute with `Authorization: Bearer CRON_SECRET`),
  credited to the player, and withdrawn by the player after verifying.

## Setup
1. Create a Neon database and run `db/schema.sql` in its SQL editor.
2. Copy `.env.example` values into Vercel's Environment Variables (`NEXT_PUBLIC_*` as Config).
3. Deploy on Vercel, then point a cron job at `/api/cron/crank`.

`npm test` runs the unit tests.

Not affiliated with Rockstar Games, Take-Two Interactive, Twitch, Kick or pump.fun.
