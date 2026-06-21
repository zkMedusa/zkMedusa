import { STAKING_LOCK_TIERS } from "@/lib/staking/config";

/** One fixed-lock Streamflow stake pool + dynamic reward pool + fund delegate top-up. */
export interface StreamflowTierPool {
  days: number;
  label: string;
  /** Stake pool PDA — pass to Streamflow `stake()`. */
  stakePool: string;
  /** Dynamic reward pool linked to the stake pool. */
  rewardPool: string;
  /** Fund delegate PDA (schedule config). */
  fundDelegate: string;
  /** Token-2022 ATA where buyback MEDUSA is deposited before daily pool top-up. */
  topUpAddress: string;
  /** Share of each buyback drip routed to this tier's top-up. */
  buybackSharePercent: number;
}

const DEFAULT_STREAMFLOW_TIER_POOLS: StreamflowTierPool[] = [
  {
    days: 7,
    label: "7 days",
    stakePool: "6HtvP9VKSxvfe2kdnZDCiSwgDnRYaJjMLEdJPfCpn86G",
    rewardPool: "9Tum3seCmGRjvHAVRivNw4z1SX9YpCaDkXFv9k4yokm9",
    fundDelegate: "8goynXrEhVqdFd6wcNSbKUL9Cz3tEzyUcnGnbrCLZNL8",
    topUpAddress: "9AXSVkhRBjk5YhiH8WdFt75EbrCBe37vMD5RhYxdQohR",
    buybackSharePercent: 10,
  },
  {
    days: 30,
    label: "30 days",
    stakePool: "Am9wVQVVftYvv6VVFHk4o3cqscwDnpjfGV5uFGz9jQ48",
    rewardPool: "atx35ABujkz7wadg7j779C8KkKBPE5DaWLYsMB3xkHw",
    fundDelegate: "5tYitqsbFcwWyDS8NYawZ1dteqMy2PguSBXZi63WKUUS",
    topUpAddress: "5SEiWDzehLZxdTBZQaUNExLzbsnwXsY1hpD4E9QsmrRg",
    buybackSharePercent: 15,
  },
  {
    days: 90,
    label: "90 days",
    stakePool: "9ytm6H4BHPfcU2UFi6LNaxqn57JaWqRApGr2V7RSjhaf",
    rewardPool: "9YJfse8BrLmdPDAU3AMzTHu6ZhVgpAQ5LFNREVcDuyRu",
    fundDelegate: "4GZZu6xRShNJ4ZS2Vuaj5DpWoZxAsMFcJrNLE6t1koyk",
    topUpAddress: "ANkFBLyFbPymfgiH9Bdd47fY1jHh6wVJrHPXCJaGgwZ9",
    buybackSharePercent: 25,
  },
  {
    days: 180,
    label: "180 days",
    stakePool: "8WYMr8daoK7inJnvK1DuCbpaQqYCDwrXsLLSvCvFU17L",
    rewardPool: "38RytrUWn1AZvqcJtVifaUmGu6aJ8LwAPf53GJU33JZb",
    fundDelegate: "42ZrmAKwDqGMuPet9GZXk4t11GVBmF2AtMmEFJzSVXtr",
    topUpAddress: "GMFyjSV5CDXNNmj4TvPtpVrktsMQap883BdRhxq4rb1L",
    buybackSharePercent: 50,
  },
];

/** Static env reads — Next.js only inlines literal `process.env.NEXT_PUBLIC_*` keys. */
const ENV_STAKE_POOLS: Record<number, string | undefined> = {
  7: process.env.NEXT_PUBLIC_STREAMFLOW_STAKE_POOL_7D?.trim(),
  30: process.env.NEXT_PUBLIC_STREAMFLOW_STAKE_POOL_30D?.trim(),
  90: process.env.NEXT_PUBLIC_STREAMFLOW_STAKE_POOL_90D?.trim(),
  180: process.env.NEXT_PUBLIC_STREAMFLOW_STAKE_POOL_180D?.trim(),
};

const ENV_REWARD_POOLS: Record<number, string | undefined> = {
  7: process.env.NEXT_PUBLIC_STREAMFLOW_REWARD_POOL_7D?.trim(),
  30: process.env.NEXT_PUBLIC_STREAMFLOW_REWARD_POOL_30D?.trim(),
  90: process.env.NEXT_PUBLIC_STREAMFLOW_REWARD_POOL_90D?.trim(),
  180: process.env.NEXT_PUBLIC_STREAMFLOW_REWARD_POOL_180D?.trim(),
};

/** Server-only top-up accounts (no NEXT_PUBLIC_ prefix). */
const ENV_TOPUP_POOLS: Record<number, string | undefined> = {
  7: process.env.STREAMFLOW_TOPUP_7D?.trim(),
  30: process.env.STREAMFLOW_TOPUP_30D?.trim(),
  90: process.env.STREAMFLOW_TOPUP_90D?.trim(),
  180: process.env.STREAMFLOW_TOPUP_180D?.trim(),
};

function pickOverride<T extends string>(
  value: string | undefined,
  fallback: T,
): T {
  return value && value.length > 0 ? (value as T) : fallback;
}

function readTierFromEnv(defaults: StreamflowTierPool): StreamflowTierPool {
  const { days } = defaults;
  const tier = STAKING_LOCK_TIERS.find((entry) => entry.days === days);

  return {
    ...defaults,
    label: tier?.label ?? defaults.label,
    stakePool: pickOverride(ENV_STAKE_POOLS[days], defaults.stakePool),
    rewardPool: pickOverride(ENV_REWARD_POOLS[days], defaults.rewardPool),
    topUpAddress: pickOverride(ENV_TOPUP_POOLS[days], defaults.topUpAddress),
    buybackSharePercent: tier?.multiplierPercent ?? defaults.buybackSharePercent,
  };
}

/** Verified mainnet Streamflow pools (env overrides optional). */
export function getStreamflowTierPools(): StreamflowTierPool[] {
  return DEFAULT_STREAMFLOW_TIER_POOLS.map(readTierFromEnv);
}

export function getStreamflowTier(days: number): StreamflowTierPool | undefined {
  return getStreamflowTierPools().find((tier) => tier.days === days);
}

export function isStreamflowStakingConfigured(): boolean {
  return getStreamflowTierPools().every(
    (tier) =>
      Boolean(tier.stakePool?.length) && Boolean(tier.rewardPool?.length),
  );
}
