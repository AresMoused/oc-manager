import { createPublicKey, verify } from "node:crypto";

/** Ed25519 verify for Discord Interactions. */
export function verifyDiscordSignature(
  rawBody: string,
  timestamp: string,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  if (!rawBody || !timestamp || !signatureHex || !publicKeyHex) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKeyHex, "hex"),
      ]),
      format: "der",
      type: "spki",
    });
    return verify(
      null,
      Buffer.from(timestamp + rawBody),
      key,
      Buffer.from(signatureHex, "hex")
    );
  } catch {
    return false;
  }
}
