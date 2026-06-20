export const LAMPORTS_PER_SOL = 1_000_000_000;

export const PASSPORT_POLICY_VERSION = "medusa-passport-v1";

export const PASSPORT_VALIDITY_DAYS = 90;

export const PASSPORT_ISSUE_PRICE_USDC = "0.50";

export const PASSPORT_TIERS = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
} as const;

export type PassportTier = (typeof PASSPORT_TIERS)[keyof typeof PASSPORT_TIERS];

export const TIER_LABELS: Record<PassportTier, string> = {
  [PASSPORT_TIERS.BRONZE]: "BRONZE",
  [PASSPORT_TIERS.SILVER]: "SILVER",
  [PASSPORT_TIERS.GOLD]: "GOLD",
};

export const PASSPORT_REQUIREMENTS = {
  minWalletAgeDays: 90,
  minTransactionCount: 20,
  volumeWindowDays: 90,
  tierVolumeThresholdsLamports: {
    bronze: 10 * LAMPORTS_PER_SOL,
    silver: 50 * LAMPORTS_PER_SOL,
    gold: 200 * LAMPORTS_PER_SOL,
  },
} as const;

export function getMinAgeSeconds(): number {
  return PASSPORT_REQUIREMENTS.minWalletAgeDays * 24 * 60 * 60;
}

export function getVolumeWindowSeconds(): number {
  return PASSPORT_REQUIREMENTS.volumeWindowDays * 24 * 60 * 60;
}

export function getPublicInputs(currentTimestamp: number) {
  const { tierVolumeThresholdsLamports } = PASSPORT_REQUIREMENTS;

  return {
    current_timestamp: currentTimestamp,
    min_age_seconds: getMinAgeSeconds(),
    min_tx_count: PASSPORT_REQUIREMENTS.minTransactionCount,
    bronze_threshold: tierVolumeThresholdsLamports.bronze,
    silver_threshold: tierVolumeThresholdsLamports.silver,
    gold_threshold: tierVolumeThresholdsLamports.gold,
  };
}

export function getSolanaNetwork(): "devnet" | "mainnet-beta" {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  return network === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

export function getSolanaRpcUrl(): string {
  if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  }

  return getSolanaNetwork() === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

export function getSolanaExplorerUrl(
  value: string,
  kind: "address" | "tx" = "address",
): string {
  const suffix =
    getSolanaNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/${kind}/${value}${suffix}`;
}

export function getAppBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  return configured ? configured.replace(/\/$/, "") : "";
}

/**
 * Server-only: base58-encoded secret key of the wallet that mints + owns
 * (update authority) the soulbound passport badges. This wallet pays rent and
 * tx fees, so keep it funded.
 */
export function getBadgeAuthoritySecretKey(): string | null {
  return process.env.MEDUSA_BADGE_AUTHORITY_SECRET_KEY?.trim() || null;
}

/** Optional MPL Core collection the badges are minted into. */
export function getBadgeCollectionAddress(): string | null {
  return (
    process.env.MEDUSA_BADGE_COLLECTION?.trim() ||
    process.env.NEXT_PUBLIC_MEDUSA_BADGE_COLLECTION?.trim() ||
    null
  );
}

/** RPC used for minting badges (server). Falls back to the app RPC. */
export function getBadgeRpcUrl(): string {
  return process.env.MEDUSA_BADGE_RPC_URL?.trim() || getSolanaRpcUrl();
}

/**
 * Client-visible flag that toggles the badge minting UI. Defaults to enabled
 * when a public collection address is configured.
 */
export function isBadgeMintingEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_MEDUSA_BADGE_ENABLED?.trim();
  if (flag === "true") {
    return true;
  }
  if (flag === "false") {
    return false;
  }
  return Boolean(process.env.NEXT_PUBLIC_MEDUSA_BADGE_COLLECTION?.trim());
}

export function getPassportIssuePriceLabel(): string {
  const configured =
    process.env.NEXT_PUBLIC_PASSPORT_ISSUE_PRICE_USDC ??
    process.env.PASSPORT_ISSUE_PRICE_USDC;

  if (configured) {
    return configured.startsWith("$") ? configured : `$${configured}`;
  }

  return `$${PASSPORT_ISSUE_PRICE_USDC}`;
}

export function getX402SolanaNetworkCaip2(): `solana:${string}` {
  return getSolanaNetwork() === "mainnet-beta"
    ? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
    : "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
}

const DEVNET_X402_FACILITATOR_URL = "https://x402.org/facilitator";
const CDP_X402_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

export function isCdpFacilitatorUrl(url: string): boolean {
  return url.includes("cdp.coinbase.com");
}

export function getCdpApiCredentials(): { id: string; secret: string } | null {
  const id = process.env.CDP_API_KEY_ID ?? process.env.X402_CDP_API_KEY_ID;
  const secret =
    process.env.CDP_API_KEY_SECRET ?? process.env.X402_CDP_API_KEY_SECRET;

  if (id && secret) {
    return { id, secret };
  }

  return null;
}

export function getX402FacilitatorUrl(): string {
  const configured = process.env.X402_FACILITATOR_URL?.trim();
  const network = getSolanaNetwork();

  if (configured) {
    if (isCdpFacilitatorUrl(configured) && !getCdpApiCredentials()) {
      if (network !== "mainnet-beta") {
        return DEVNET_X402_FACILITATOR_URL;
      }
    }

    return configured;
  }

  return network === "mainnet-beta"
    ? CDP_X402_FACILITATOR_URL
    : DEVNET_X402_FACILITATOR_URL;
}

export function assertX402FacilitatorConfigured(): void {
  if (process.env.PASSPORT_DEV_SKIP_PAYMENT === "true") {
    return;
  }

  const url = getX402FacilitatorUrl();

  if (isCdpFacilitatorUrl(url) && !getCdpApiCredentials()) {
    throw new Error(
      "Coinbase CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET. For devnet, set NEXT_PUBLIC_SOLANA_NETWORK=devnet and use https://x402.org/facilitator (or leave X402_FACILITATOR_URL unset).",
    );
  }
}
