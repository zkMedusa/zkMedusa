import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import type { SolanaStakingClient, StakeEntry } from "@streamflow/staking";
import { getMedusaMintAddress } from "@/lib/staking/config";
import {
  getDefaultMedusaDecimals,
  rawToMedusaAmount,
  sumMedusaAmounts,
} from "@/lib/staking/amounts";
import {
  getStreamflowTierPools,
  isStreamflowStakingConfigured,
  type StreamflowTierPool,
} from "@/lib/staking/streamflowPools";
import {
  getStreamflowStakingClient,
  loadStakingSdk,
} from "@/lib/staking/streamflowSdk.server";
import {
  STAKING_CACHE_KEYS,
  STAKING_CACHE_TTL,
  readStakingCache,
  withStakingCache,
} from "@/lib/staking/stakingCache.server";
import type {
  StakingGlobalStats,
  StakingTierPosition,
  StakingUserPosition,
} from "@/lib/staking/types";

let mintDecimalsPromise: Promise<number> | null = null;

async function getConnection(): Promise<Connection> {
  const client = await getStreamflowStakingClient();
  return client.connection;
}

async function getMintDecimals(): Promise<number> {
  if (!mintDecimalsPromise) {
    mintDecimalsPromise = (async () => {
      const mint = getMedusaMintAddress();
      const connection = await getConnection();
      const info = await connection.getParsedAccountInfo(new PublicKey(mint));
      const parsed = info.value?.data;
      if (parsed && typeof parsed === "object" && "parsed" in parsed) {
        const decimals = (parsed as { parsed: { info: { decimals?: number } } })
          .parsed.info.decimals;
        if (typeof decimals === "number") {
          return decimals;
        }
      }
      return getDefaultMedusaDecimals();
    })();
  }
  return mintDecimalsPromise;
}

function isActiveStakeEntry(entry: StakeEntry): boolean {
  return entry.closedTs.isZero();
}

function lockExpiresAt(entry: StakeEntry): string | null {
  if (!isActiveStakeEntry(entry)) {
    return null;
  }
  const endSeconds =
    Number(entry.createdTs.toString()) + Number(entry.duration.toString());
  return new Date(endSeconds * 1000).toISOString();
}

function canUnstake(entry: StakeEntry): boolean {
  if (!isActiveStakeEntry(entry)) {
    return false;
  }
  const endSeconds =
    Number(entry.createdTs.toString()) + Number(entry.duration.toString());
  return Date.now() / 1000 >= endSeconds;
}

async function getTokenAccountRawAmount(address: string): Promise<bigint> {
  try {
    const connection = await getConnection();
    const balance = await connection.getTokenAccountBalance(
      new PublicKey(address),
    );
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

async function getTopUpBalanceRaw(topUpAddress: string): Promise<bigint> {
  return getTokenAccountRawAmount(topUpAddress);
}

function bnToSeconds(value: BN | { toString(): string }): number {
  return Number(value.toString());
}

function deriveNextFundDrip(
  lastFundTs: BN,
  period: BN,
  expiryTs: BN,
): string | null {
  const lastFundSeconds = bnToSeconds(lastFundTs);
  const periodSeconds = bnToSeconds(period);
  const expirySeconds = bnToSeconds(expiryTs);

  if (!lastFundSeconds || !periodSeconds) {
    return null;
  }

  let nextSeconds = lastFundSeconds + periodSeconds;
  const nowSeconds = Math.floor(Date.now() / 1000);
  while (nextSeconds <= nowSeconds && nextSeconds < expirySeconds) {
    nextSeconds += periodSeconds;
  }

  if (nextSeconds >= expirySeconds) {
    return null;
  }

  return new Date(nextSeconds * 1000).toISOString();
}

type DynamicRewardPool = Awaited<
  ReturnType<
    SolanaStakingClient["programs"]["rewardPoolDynamicProgram"]["account"]["rewardPool"]["fetch"]
  >
>;

type DynamicRewardEntry = Awaited<
  ReturnType<
    SolanaStakingClient["programs"]["rewardPoolDynamicProgram"]["account"]["rewardEntry"]["fetch"]
  >
>;

async function fetchDynamicRewardEntry(
  client: SolanaStakingClient,
  rewardPool: string,
  stakeEntry: PublicKey,
): Promise<DynamicRewardEntry | undefined> {
  const { deriveRewardEntryPDA } = await loadStakingSdk();
  const rewardEntryPk = deriveRewardEntryPDA(
    client.programs.rewardPoolDynamicProgram.programId,
    new PublicKey(rewardPool),
    stakeEntry,
  );

  try {
    return await client.programs.rewardPoolDynamicProgram.account.rewardEntry.fetch(
      rewardEntryPk,
    );
  } catch {
    return undefined;
  }
}

/** Dynamic pools use `rewards_state` accumulators — not `calcRewards` (fixed pools only). */
function calcDynamicClaimable(
  stakeEntry: StakeEntry,
  rewardEntry: DynamicRewardEntry | undefined,
  rewardPool: DynamicRewardPool,
): BN {
  if (!rewardEntry) {
    return new BN(0);
  }

  const poolState = new BN(rewardPool.rewardsState.toString());
  const entryState = new BN(rewardEntry.rewardsState.toString());
  if (poolState.lte(entryState)) {
    return new BN(0);
  }

  const precision = new BN(10).pow(new BN(rewardPool.rewardsStatePrecision));
  const delta = poolState.sub(entryState);
  const effective = new BN(stakeEntry.effectiveAmount.toString());
  const earned = delta.mul(effective).div(precision);
  const claimed = new BN(rewardEntry.claimedAmount.toString());
  const claimable = earned.sub(claimed);

  return claimable.lt(new BN(0)) ? new BN(0) : claimable;
}

async function buildTierPosition(
  tier: StreamflowTierPool,
  wallet: string,
  decimals: number,
  client: SolanaStakingClient,
): Promise<StakingTierPosition[]> {
  const entries = await client.searchStakeEntries({
    stakePool: new PublicKey(tier.stakePool),
    payer: new PublicKey(wallet),
  });

  const activeEntries = entries.filter((entry) =>
    isActiveStakeEntry(entry.account),
  );
  if (activeEntries.length === 0) {
    return [];
  }

  const [stakePool, rewardPoolAccount] = await Promise.all([
    client.getStakePool(tier.stakePool),
    client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
      tier.rewardPool,
    ),
  ]);

  const totalEffectiveStake = BigInt(stakePool.totalEffectiveStake.toString());
  const rewardEntries = await Promise.all(
    activeEntries.map((entry) =>
      fetchDynamicRewardEntry(client, tier.rewardPool, entry.publicKey),
    ),
  );

  return activeEntries.map((entry, index) => {
    const rewardEntry = rewardEntries[index];
    const claimableRaw = calcDynamicClaimable(
      entry.account,
      rewardEntry,
      rewardPoolAccount,
    );
    const effectiveAmount = BigInt(entry.account.effectiveAmount.toString());
    const weightSharePercent =
      totalEffectiveStake > BigInt(0)
        ? Number((effectiveAmount * BigInt(10000)) / totalEffectiveStake) / 100
        : 0;

    return {
      tierDays: tier.days,
      tierLabel: tier.label,
      stakePool: tier.stakePool,
      rewardPool: tier.rewardPool,
      stakeEntry: entry.publicKey.toBase58(),
      stakedMedusa: rawToMedusaAmount(entry.account.amount, decimals),
      lockExpiresAt: lockExpiresAt(entry.account),
      claimableMedusa: rawToMedusaAmount(claimableRaw, decimals),
      totalClaimedMedusa: rawToMedusaAmount(
        rewardEntry?.claimedAmount ?? 0,
        decimals,
      ),
      weightSharePercent,
      canUnstake: canUnstake(entry.account),
      stakeNonce: entry.account.nonce,
      rewardPoolNonce: rewardPoolAccount.nonce,
    };
  });
}

async function readCachedActiveStakerCount(): Promise<number> {
  const cached = await readStakingCache<number>(STAKING_CACHE_KEYS.activeStakers);
  return typeof cached === "number" && cached >= 0 ? cached : 0;
}

async function refreshActiveStakerCount(): Promise<number> {
  return withStakingCache(
    STAKING_CACHE_KEYS.activeStakers,
    STAKING_CACHE_TTL.activeStakersSeconds,
    async () => {
      const client = await getStreamflowStakingClient();
      const tiers = getStreamflowTierPools();
      const uniqueStakers = new Set<string>();

      const entryGroups = await Promise.all(
        tiers.map(async (tier) => {
          try {
            return await client.searchStakeEntries({
              stakePool: new PublicKey(tier.stakePool),
            });
          } catch (error) {
            console.error(`[staking/stats] active stakers ${tier.days}d`, error);
            return [];
          }
        }),
      );

      for (const entries of entryGroups) {
        for (const entry of entries) {
          if (isActiveStakeEntry(entry.account)) {
            uniqueStakers.add(entry.account.payer.toBase58());
          }
        }
      }

      return uniqueStakers.size;
    },
  );
}

export async function warmStakingCaches(): Promise<StakingGlobalStats> {
  await refreshActiveStakerCount();
  return withStakingCache(
    STAKING_CACHE_KEYS.stats,
    STAKING_CACHE_TTL.statsSeconds,
    fetchStakingGlobalStatsUncached,
  );
}

interface TierStatsSlice {
  totalStakedRaw: bigint;
  pendingRewardPoolRaw: bigint;
  totalBuybacksRaw: bigint;
  totalClaimedRaw: bigint;
  lastDripAt: string | null;
  nextDripAt: string | null;
}

async function fetchTierStatsSlice(
  client: SolanaStakingClient,
  tier: StreamflowTierPool,
): Promise<TierStatsSlice> {
  const [pool, topUpRaw, rewardPoolAccount] = await Promise.all([
    client.getStakePool(tier.stakePool),
    getTopUpBalanceRaw(tier.topUpAddress),
    client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
      tier.rewardPool,
    ),
  ]);

  const claimedRaw = BigInt(rewardPoolAccount.claimedAmount.toString());
  const vaultRaw = await getTokenAccountRawAmount(
    rewardPoolAccount.vault.toBase58(),
  );

  let lastDripAt: string | null = null;
  let nextDripAt: string | null = null;

  try {
    const fundDelegate =
      await client.programs.rewardPoolDynamicProgram.account.fundDelegate.fetch(
        new PublicKey(tier.fundDelegate),
      );
    const lastFundSeconds = bnToSeconds(fundDelegate.lastFundTs);
    if (lastFundSeconds > 0) {
      lastDripAt = new Date(lastFundSeconds * 1000).toISOString();
    }
    nextDripAt = deriveNextFundDrip(
      fundDelegate.lastFundTs,
      fundDelegate.period,
      fundDelegate.expiryTs,
    );
  } catch (error) {
    console.error(`[staking/stats] fund delegate ${tier.days}d`, error);
  }

  return {
    totalStakedRaw: BigInt(pool.totalStake.toString()),
    pendingRewardPoolRaw: topUpRaw,
    totalBuybacksRaw: topUpRaw + vaultRaw + claimedRaw,
    totalClaimedRaw: claimedRaw,
    lastDripAt,
    nextDripAt,
  };
}

async function fetchStakingGlobalStatsUncached(): Promise<StakingGlobalStats> {
  const configured = isStreamflowStakingConfigured();
  if (!configured) {
    return {
      activeStakers: 0,
      totalStakedMedusa: "0",
      totalBuybacksMedusa: "0",
      totalRewardsClaimedMedusa: "0",
      pendingRewardPoolMedusa: "0",
      lastDripAt: null,
      nextDripAt: null,
      configured: false,
    };
  }

  const client = await getStreamflowStakingClient();
  const decimals = await getMintDecimals();
  const tiers = getStreamflowTierPools();

  const tierSlices = await Promise.all(
    tiers.map(async (tier) => {
      try {
        return await fetchTierStatsSlice(client, tier);
      } catch (error) {
        console.error(`[staking/stats] tier ${tier.days}d`, error);
        return null;
      }
    }),
  );

  let totalStakedRaw = BigInt(0);
  let pendingRewardPoolRaw = BigInt(0);
  let totalBuybacksRaw = BigInt(0);
  let totalClaimedRaw = BigInt(0);
  let lastDripAt: string | null = null;
  let nextDripAt: string | null = null;

  for (const slice of tierSlices) {
    if (!slice) {
      continue;
    }
    totalStakedRaw += slice.totalStakedRaw;
    pendingRewardPoolRaw += slice.pendingRewardPoolRaw;
    totalBuybacksRaw += slice.totalBuybacksRaw;
    totalClaimedRaw += slice.totalClaimedRaw;
    if (slice.lastDripAt && (!lastDripAt || slice.lastDripAt > lastDripAt)) {
      lastDripAt = slice.lastDripAt;
    }
    if (slice.nextDripAt && (!nextDripAt || slice.nextDripAt < nextDripAt)) {
      nextDripAt = slice.nextDripAt;
    }
  }

  const activeStakers = await readCachedActiveStakerCount();

  return {
    activeStakers,
    totalStakedMedusa: rawToMedusaAmount(totalStakedRaw, decimals),
    totalBuybacksMedusa: rawToMedusaAmount(totalBuybacksRaw, decimals),
    totalRewardsClaimedMedusa: rawToMedusaAmount(totalClaimedRaw, decimals),
    pendingRewardPoolMedusa: rawToMedusaAmount(pendingRewardPoolRaw, decimals),
    lastDripAt,
    nextDripAt,
    configured: true,
  };
}

export async function fetchStakingGlobalStats(): Promise<StakingGlobalStats> {
  if (!isStreamflowStakingConfigured()) {
    return fetchStakingGlobalStatsUncached();
  }

  return withStakingCache(
    STAKING_CACHE_KEYS.stats,
    STAKING_CACHE_TTL.statsSeconds,
    fetchStakingGlobalStatsUncached,
  );
}

async function fetchStakingUserPositionUncached(
  wallet: string,
): Promise<StakingUserPosition | null> {
  if (!isStreamflowStakingConfigured()) {
    return null;
  }

  try {
    new PublicKey(wallet);
  } catch {
    return null;
  }

  const decimals = await getMintDecimals();
  const tiers = getStreamflowTierPools();
  const client = await getStreamflowStakingClient();
  const tierResults = await Promise.all(
    tiers.map(async (tier) => {
      try {
        return await buildTierPosition(tier, wallet, decimals, client);
      } catch (error) {
        console.error(`[staking/position] tier ${tier.days}d`, error);
        return [] as StakingTierPosition[];
      }
    }),
  );
  const positions = tierResults.flat();

  if (positions.length === 0) {
    return {
      wallet,
      stakedMedusa: "0",
      claimableMedusa: "0",
      totalClaimedMedusa: "0",
      lockDays: 0,
      lockMultiplierPercent: 0,
      lockExpiresAt: null,
      weightSharePercent: 0,
      positions: [],
    };
  }

  const stakedMedusa = sumMedusaAmounts(
    positions.map((position) => position.stakedMedusa),
  );
  const claimableMedusa = sumMedusaAmounts(
    positions.map((position) => position.claimableMedusa),
  );
  const totalClaimedMedusa = sumMedusaAmounts(
    positions.map((position) => position.totalClaimedMedusa),
  );
  const primaryTier = [...positions].sort(
    (left, right) => right.tierDays - left.tierDays,
  )[0];
  const tierMeta = tiers.find((tier) => tier.days === primaryTier.tierDays);
  const nearestUnlock = positions
    .map((position) => position.lockExpiresAt)
    .filter(Boolean)
    .sort()[0] ?? null;

  return {
    wallet,
    stakedMedusa,
    claimableMedusa,
    totalClaimedMedusa,
    lockDays: primaryTier.tierDays,
    lockMultiplierPercent: tierMeta?.buybackSharePercent ?? 0,
    lockExpiresAt: nearestUnlock,
    weightSharePercent:
      positions.reduce(
        (total, position) => total + position.weightSharePercent,
        0,
      ) / positions.length,
    positions,
  };
}

export async function fetchStakingUserPosition(
  wallet: string,
): Promise<StakingUserPosition | null> {
  if (!isStreamflowStakingConfigured()) {
    return fetchStakingUserPositionUncached(wallet);
  }

  return withStakingCache(
    STAKING_CACHE_KEYS.position(wallet),
    STAKING_CACHE_TTL.positionSeconds,
    () => fetchStakingUserPositionUncached(wallet),
  );
}

export async function getRewardPoolNonce(rewardPool: string): Promise<number> {
  const client = await getStreamflowStakingClient();
  const account =
    await client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
      rewardPool,
    );
  return account.nonce;
}

export async function findAvailableStakeNonce(
  stakePool: string,
  wallet: string,
): Promise<number> {
  const client = await getStreamflowStakingClient();
  const entries = await client.searchStakeEntries({
    stakePool: new PublicKey(stakePool),
    payer: new PublicKey(wallet),
  });
  const used = new Set(entries.map((entry) => entry.account.nonce));
  for (let nonce = 0; nonce < 256; nonce += 1) {
    if (!used.has(nonce)) {
      return nonce;
    }
  }
  throw new Error("Maximum number of stake positions reached for this pool.");
}

export function getMedusaTokenProgramId(): PublicKey {
  return TOKEN_2022_PROGRAM_ID;
}

export { getMintDecimals };
