/** Protocol-wide metrics shown at the top of /stake. */
export interface StakingGlobalStats {
  activeStakers: number;
  /** Human-readable token amounts (e.g. "1250000.5"). */
  totalStakedMedusa: string;
  /** MEDUSA in top-ups, pool vaults, and already claimed rewards. */
  totalBuybacksMedusa: string;
  totalRewardsClaimedMedusa: string;
  /** Sum of MEDUSA sitting in Streamflow fund-delegate top-ups. */
  pendingRewardPoolMedusa: string;
  lastDripAt: string | null;
  nextDripAt: string | null;
  configured: boolean;
}

/** One active Streamflow stake entry in a fixed-lock tier pool. */
export interface StakingTierPosition {
  tierDays: number;
  tierLabel: string;
  stakePool: string;
  rewardPool: string;
  stakeEntry: string;
  stakedMedusa: string;
  lockExpiresAt: string | null;
  claimableMedusa: string;
  totalClaimedMedusa: string;
  weightSharePercent: number;
  canUnstake: boolean;
  stakeNonce: number;
  rewardPoolNonce: number;
}

/** Per-wallet staking summary across all tier pools. */
export interface StakingUserPosition {
  wallet: string;
  stakedMedusa: string;
  claimableMedusa: string;
  totalClaimedMedusa: string;
  /** Longest active lock tier (0 when unstaked). */
  lockDays: number;
  lockMultiplierPercent: number;
  /** Soonest upcoming unlock among active positions. */
  lockExpiresAt: string | null;
  weightSharePercent: number;
  positions: StakingTierPosition[];
}

export interface BuybackTierTransfer {
  tierDays: number;
  topUpAddress: string;
  amountMedusa: string;
  signature?: string;
}

/** One buyback cron execution (stored in KV). */
export interface BuybackRunRecord {
  ranAt: string;
  ok: boolean;
  dryRun: boolean;
  skipped?: string;
  authority: string;
  devWallet: string;
  treasuryWallet: string | null;
  pumpClaimableLamports: string;
  pumpClaimedLamports: string;
  pumpClaimSignature?: string;
  pumpUsesSharingConfig?: boolean;
  pumpSolBuybackLamports: string;
  pumpSolTreasuryLamports: string;
  passportUsdcBuybackMicro: string;
  passportUsdcToSolMicro: string;
  solForMedusaLamports: string;
  medusaBuybackRaw: string;
  medusaDistributedRaw: string;
  tierTransfers: BuybackTierTransfer[];
  signatures: string[];
  errors: string[];
}
