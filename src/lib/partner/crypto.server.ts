import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Reversible encryption for holder addresses at rest. Unlike the HMAC holderId
 * (one-way), this lets the daily cron decrypt and re-query balances. The key is
 * server-only; a database leak alone does not expose addresses, but the operator
 * (who holds the key) can decrypt them.
 */
function getKey(): Buffer {
  const hex = process.env.MEDUSA_PARTNER_ENCRYPTION_KEY?.trim();
  if (!hex) {
    throw new Error("MEDUSA_PARTNER_ENCRYPTION_KEY is not configured.");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "MEDUSA_PARTNER_ENCRYPTION_KEY must be 32 bytes (64 hex chars).",
    );
  }
  return key;
}

/** AES-256-GCM. Output: base64(iv[12] | tag[16] | ciphertext). */
export function encryptAddress(address: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(address.toLowerCase(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptAddress(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/** True when an encryption key is configured (enables cron auto-refresh). */
export function isAddressEncryptionConfigured(): boolean {
  const hex = process.env.MEDUSA_PARTNER_ENCRYPTION_KEY?.trim();
  return Boolean(hex && Buffer.from(hex, "hex").length === 32);
}
