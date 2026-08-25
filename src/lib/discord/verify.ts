import nacl from "tweetnacl";

/** Ed25519 verify for Discord Interactions (same method as Discord docs). */
export function verifyDiscordSignature(
  rawBody: string,
  timestamp: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const keyHex = publicKeyHex.trim();
  const sigHex = signatureHex.trim();
  if (!rawBody || !timestamp || !sigHex || !keyHex) return false;
  try {
    const key = Buffer.from(keyHex, "hex");
    const sig = Buffer.from(sigHex, "hex");
    if (key.length !== 32 || sig.length !== 64) return false;
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      sig,
      key
    );
  } catch {
    return false;
  }
}
