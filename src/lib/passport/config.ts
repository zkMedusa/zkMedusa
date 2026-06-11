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
  minWalletAgeDays: 180,
  minTransactionCount: 50,
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

export function getX402FacilitatorUrl(): string {
  if (process.env.X402_FACILITATOR_URL) {
    return process.env.X402_FACILITATOR_URL;
  }

  return getSolanaNetwork() === "mainnet-beta"
    ? "https://api.cdp.coinbase.com/platform/v2/x402"
    : "https://x402.org/facilitator";
}
