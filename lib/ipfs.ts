import "server-only";

/**
 * Pins the image + metadata through pump.fun's own IPFS endpoint (the same one pump.fun's
 * create page uses) and returns the metadata URI for create_v2.
 */
export async function pinMetadata(a: {
  image: Blob;
  imageName: string;
  name: string;
  symbol: string;
  description: string;
  website?: string;
  twitter?: string;
}): Promise<{ metadataUri: string; imageUri: string | null }> {
  const form = new FormData();
  form.append("file", a.image, a.imageName);
  form.append("name", a.name);
  form.append("symbol", a.symbol);
  form.append("description", a.description);
  if (a.website) form.append("website", a.website);
  if (a.twitter) form.append("twitter", a.twitter);
  form.append("showName", "true");

  const r = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: form });
  if (!r.ok) throw new Error(`Image upload failed (${r.status})`);
  const j = await r.json();
  if (!j?.metadataUri) throw new Error("Image upload returned no metadata URI");
  return { metadataUri: j.metadataUri, imageUri: j.metadata?.image ?? null };
}
