/** Default $MEDUSA mint (Pump.fun). Override with NEXT_PUBLIC_MEDUSA_TOKEN_MINT. */
export const DEFAULT_MEDUSA_MINT =
  "HYdWaJRTW4vVTFPjUaUV7J7JXHzxMnvogBr4ZFupump";

export function getMedusaMintAddress(): string {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_TOKEN_MINT?.trim() || DEFAULT_MEDUSA_MINT
  );
}

/** Share of Pump.fun creator/dev fees routed to the buyback pool. */
export const PUMPFUN_DEV_FEE_BUYBACK_PERCENT = 80;

/** Share of passport x402 USDC revenue routed toward buyback (via SOL conversion). */
export const PASSPORT_USDC_BUYBACK_PERCENT = 50;

/** Share of passport USDC buyback slice converted to SOL before dev-wallet buyback. */
export const PASSPORT_USDC_TO_SOL_PERCENT = 50;

/** Remaining passport revenue stays in ops treasury (not in buyback). */
export const PASSPORT_TREASURY_RESERVE_PERCENT = 50;

/** Ops treasury share of Pump.fun dev fees (complement of buyback). */
export const PUMPFUN_TREASURY_PERCENT = 100 - PUMPFUN_DEV_FEE_BUYBACK_PERCENT;

/** Target cadence for revenue drips (backend cron). */
export const DRIP_INTERVAL_MINUTES = 30;

export interface StakingLockTier {
  days: number;
  multiplierPercent: number;
  label: string;
}

/** Longer lock → larger slice of each buyback drip. */
export const STAKING_LOCK_TIERS: StakingLockTier[] = [
  { days: 7, multiplierPercent: 10, label: "7 days" },
  { days: 30, multiplierPercent: 15, label: "30 days" },
  { days: 90, multiplierPercent: 25, label: "90 days" },
  { days: 180, multiplierPercent: 50, label: "180 days" },
];

export function getLockTier(days: number): StakingLockTier | undefined {
  return STAKING_LOCK_TIERS.find((tier) => tier.days === days);
}
