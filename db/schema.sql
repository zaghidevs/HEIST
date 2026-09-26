-- HEIST schema. Balances are never stored: they are always summed from receipts.

CREATE TABLE IF NOT EXISTS channels (
  channel_id        TEXT PRIMARY KEY,               -- player id: "twitch:name", "kick:name" or "sc:name"
  platform          TEXT NOT NULL CHECK (platform IN ('twitch','kick','sc')),
  handle            TEXT,                           -- the name on that platform
  title             TEXT NOT NULL,                  -- display name
  avatar_url        TEXT,
  launches_blocked  BOOLEAN NOT NULL DEFAULT FALSE, -- player opted out of new coins
  claimed_at        TIMESTAMPTZ,                    -- first successful ownership check
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A launch the server built and is waiting for the wallet to sign.
CREATE TABLE IF NOT EXISTS launch_intents (
  id              TEXT PRIMARY KEY,
  mint            TEXT NOT NULL UNIQUE,
  channel_id      TEXT NOT NULL REFERENCES channels(channel_id),
  launcher        TEXT NOT NULL,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  metadata_uri    TEXT NOT NULL,
  image_uri       TEXT,
  create_msg      TEXT NOT NULL,   -- base64 message bytes of tx 1 (create_v2)
  sharing_msg     TEXT NOT NULL,   -- base64 message bytes of tx 2 (fee sharing)
  mint_signature  TEXT NOT NULL,   -- base64 partial signature of tx 1 by the mint key
  blockhash       TEXT NOT NULL,
  last_valid_height BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS coins (
  mint            TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL REFERENCES channels(channel_id),
  launcher        TEXT NOT NULL,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  image_uri       TEXT,
  create_sig      TEXT NOT NULL,
  sharing_sig     TEXT,
  -- routed: config names our split and is locked; unrouted: fee step failed or config changed
  route_status    TEXT NOT NULL DEFAULT 'pending' CHECK (route_status IN ('pending','routed','unrouted')),
  route_checked_at TIMESTAMPTZ,
  vault_waiting_lamports BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coins_channel_idx ON coins(channel_id);

-- Receipts. kind=push: fees moved from a coin's vault into the treasury, credited to the channel.
--           kind=claim: a withdrawal from the treasury to the player's wallet.
CREATE TABLE IF NOT EXISTS receipts (
  seq            BIGSERIAL PRIMARY KEY,             -- printed as HS-000001
  kind           TEXT NOT NULL CHECK (kind IN ('push','claim')),
  channel_id     TEXT NOT NULL REFERENCES channels(channel_id),
  mint           TEXT REFERENCES coins(mint),
  lamports       BIGINT NOT NULL CHECK (lamports >= 0),
  sol_usd        NUMERIC,
  destination    TEXT,                              -- claim only
  signature      TEXT UNIQUE,
  last_valid_height BIGINT,                         -- after this block height an unseen tx can never land
  -- pending: sent, awaiting confirmation | sent: final | failed: never landed | held: needs a human look
  status         TEXT NOT NULL CHECK (status IN ('pending','sent','failed','held')),
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS receipts_channel_idx ON receipts(channel_id);
CREATE INDEX IF NOT EXISTS receipts_status_idx ON receipts(status);

-- Ownership codes. Twitch / Kick: the player pastes the code into their channel bio and we read it
-- from the platform. Social Club has no public API: the player sends the code to the HEIST X account
-- with proof, and an admin approves it. Each code belongs to the browser that asked for it (nonce in
-- an httpOnly cookie), so nobody else can redeem it.
CREATE TABLE IF NOT EXISTS claim_codes (
  code         TEXT PRIMARY KEY,
  channel_id   TEXT NOT NULL REFERENCES channels(channel_id),
  nonce_hash   TEXT NOT NULL,
  approved_at  TIMESTAMPTZ,                       -- Social Club: set by an admin after a manual check
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS claim_codes_lookup ON claim_codes(channel_id, nonce_hash);
