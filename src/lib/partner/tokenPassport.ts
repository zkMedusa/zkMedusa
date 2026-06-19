/**
 * Portable, signed boolean credential issued to ERC-20 holders on a partner
 * page. Unlike the core Medusa passport it carries no tier and is short-lived
 * (re-checked daily). The raw wallet address is never included — only an opaque
 * HMAC `holderId`.
 */
export interface MedusaTokenPassport {
  type: "medusa_token_passport_v1";
  chain: "ethereum";
  partnerId: string;
  partnerName: string;
  token: string;
  eligible: boolean;
  /** HMAC(serverPepper, lowercased address) — opaque, not reversible. */
  holderId: string;
  /** Holding requirement in whole tokens at issuance time. */
  threshold: string;
  issuedAt: string;
  expiresAt: string;
  /** Linked Telegram handle (without @) for partner access lists. */
  telegramUsername?: string;
  issuer: "medusa";
  signature: string;
}

/** Normalizes @Alice -> alice for storage and lookup. */
export function normalizeTelegramUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Basic Telegram username validation (5–32 chars, letter first). */
export function isValidTelegramUsername(raw: string): boolean {
  const normalized = normalizeTelegramUsername(raw);
  return /^[a-z][a-z0-9_]{4,31}$/.test(normalized);
}

/** Message the user signs to prove wallet ownership (no gas, no tx). */
export function buildOwnershipMessage(
  partnerName: string,
  nonce: string,
  issuedAt: string,
): string {
  return [
    `Medusa x ${partnerName} — token passport`,
    "",
    "Sign to prove you control this wallet. This is free and does not send a transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}
