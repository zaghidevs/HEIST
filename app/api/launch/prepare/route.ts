import { randomUUID } from "node:crypto";
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { q } from "@/lib/db";
import { env } from "@/lib/env";
import { ok, fail, route } from "@/lib/http";
import { pinMetadata } from "@/lib/ipfs";
import { createCoinIxs, routeFeesIxs } from "@/lib/pump";
import { connection, isValidPubkey } from "@/lib/solana";
import { validateCoinFields } from "@/lib/format";
import { isPlayerId, PLATFORM_LABEL, splitPlayerId } from "@/lib/players-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export const POST = route(async (req: Request) => {
  const form = await req.formData();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const channelId = s("channelId");
  const name = s("name");
  const symbol = s("symbol").replace(/^\$/, "").toUpperCase();
  const userDescription = s("description").slice(0, 400);
  const website = s("website");
  const launcherStr = s("launcher");
  const image = form.get("image");

  if (!isPlayerId(channelId)) return fail("Pick a player first");
  const fieldErr = validateCoinFields(name, symbol);
  if (fieldErr) return fail(fieldErr);
  if (!isValidPubkey(launcherStr)) return fail("Connect a wallet first");
  if (!(image instanceof Blob) || image.size === 0) return fail("Add a coin image");
  if (image.size > MAX_IMAGE) return fail("Image must be 4 MB or smaller");
  if (!IMAGE_TYPES.includes(image.type)) return fail("Image must be PNG, JPEG, WebP or GIF");
  if (website && !/^https:\/\/[^\s]+$/i.test(website)) return fail("Website must start with https://");

  const [ch] = await q(`SELECT channel_id, title, launches_blocked FROM channels WHERE channel_id=$1`, [channelId]);
  if (!ch) return fail("Look the player up again");
  if (ch.launches_blocked) return fail("This player has turned off new coins in their name", 403);

  // The promise is pinned with the coin: its description names the player and platform.
  const where = PLATFORM_LABEL[splitPlayerId(channelId)!.platform];
  const pinned =
    (userDescription ? userDescription + "\n\n" : "") +
    `Creator fees go to ${ch.title} (${where}: ${splitPlayerId(channelId)!.name}) via ${env.siteName}. ` +
    `Launched by a fan; not affiliated with or endorsed by the player, Rockstar Games or Take-Two.`;

  const { metadataUri, imageUri } = await pinMetadata({
    image,
    imageName: (image as File).name || "coin.png",
    name,
    symbol,
    description: pinned,
    website: website || `${env.siteUrl}/player/${encodeURIComponent(channelId)}`,
  });

  const launcher = new PublicKey(launcherStr);
  const mint = Keypair.generate();
  const { blockhash, lastValidBlockHeight } = await connection().getLatestBlockhash("confirmed");

  const budget = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  ];

  const createTx = new Transaction({ feePayer: launcher, blockhash, lastValidBlockHeight });
  createTx.add(...budget, ...(await createCoinIxs({ mint: mint.publicKey, launcher, name, symbol, uri: metadataUri })));
  createTx.partialSign(mint);

  const routeTx = new Transaction({ feePayer: launcher, blockhash, lastValidBlockHeight });
  routeTx.add(...budget, ...(await routeFeesIxs({ mint: mint.publicKey, launcher })));

  const mintSig = createTx.signatures.find((sp) => sp.publicKey.equals(mint.publicKey))?.signature;
  if (!mintSig) throw new Error("mint signature missing");

  const id = randomUUID();
  await q(
    `INSERT INTO launch_intents (id, mint, channel_id, launcher, name, symbol, metadata_uri, image_uri,
                                 create_msg, sharing_msg, mint_signature, blockhash, last_valid_height)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id, mint.publicKey.toBase58(), channelId, launcher.toBase58(), name, symbol, metadataUri, imageUri,
      createTx.serializeMessage().toString("base64"), routeTx.serializeMessage().toString("base64"),
      Buffer.from(mintSig).toString("base64"), blockhash, lastValidBlockHeight,
    ],
  );

  const ser = (t: Transaction) => t.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  return ok({ intentId: id, mint: mint.publicKey.toBase58(), transactions: [ser(createTx), ser(routeTx)] });
});
