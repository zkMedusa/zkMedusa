/**
 * Registry of token-gated partner passports. Each partner gets a hidden page at
 * `/p/<slug>` (not linked in the navbar) where holders of a specific ERC-20 can
 * mint a short-lived boolean "token passport".
 *
 * Thresholds can be overridden per-partner with an env var so we can test with a
 * small amount and flip to production without a redeploy, e.g.:
 *   MEDUSA_TOKEN_THRESHOLD_DEEPBOT=500
 */
export interface TokenPassportPartner {
  /** Stable id, used in API routes, Redis fields and the HMAC namespace. */
  id: string;
  /** Unguessable-ish path segment for `/p/<slug>`. */
  slug: string;
  name: string;
  chain: "ethereum";
  tokenAddress: `0x${string}`;
  /** Token decimals (DeepBot uses 1e18 => 18). */
  decimals: number;
  /** Default holding requirement in whole tokens (string to avoid float math). */
  threshold: string;
  /** Passport lifetime in hours before a fresh live re-check is required. */
  validityHours: number;
  /** When true, users must submit a Telegram username at verification. */
  collectTelegram: boolean;
  branding: {
    tagline: string;
    /** Tailwind-friendly accent hex used across the page. */
    accent: string;
  };
}

const PARTNERS: TokenPassportPartner[] = [
  {
    id: "deepbot",
    slug: "deepbot",
    name: "DeepBot",
    chain: "ethereum",
    tokenAddress: "0x18bC66F0C15e27179DD8E2277C1c9c056Df0a14d",
    decimals: 18,
    threshold: "100000",
    validityHours: 24,
    collectTelegram: true,
    branding: {
      tagline: "Prove you hold $DEEPBOT — privately.",
      accent: "#22d3ee",
    },
  },
];

export function getPartnerBySlug(slug: string): TokenPassportPartner | null {
  return PARTNERS.find((partner) => partner.slug === slug) ?? null;
}

export function getPartnerById(id: string): TokenPassportPartner | null {
  return PARTNERS.find((partner) => partner.id === id) ?? null;
}

/**
 * Effective holding threshold in whole tokens. An env override
 * (`MEDUSA_TOKEN_THRESHOLD_<ID>`) wins so we can test at 500 and ship at 100000.
 */
export function getPartnerThreshold(partner: TokenPassportPartner): string {
  const override =
    process.env[`MEDUSA_TOKEN_THRESHOLD_${partner.id.toUpperCase()}`]?.trim();
  return override || partner.threshold;
}
