"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletConnectButton from "@/components/passport/WalletConnectButton";
import StreamflowLogo from "@/components/staking/StreamflowLogo";
import { useToast } from "@/components/ui/Toast";
import {
  DRIP_INTERVAL_MINUTES,
  getMedusaMintAddress,
  PASSPORT_USDC_BUYBACK_PERCENT,
  PASSPORT_USDC_TO_SOL_PERCENT,
  PUMPFUN_DEV_FEE_BUYBACK_PERCENT,
  STAKING_LOCK_TIERS,
} from "@/lib/staking/config";
import {
  formatDateTime,
  formatMedusaAmount,
  formatPercent,
} from "@/lib/staking/format";
import {
  fetchStakingPosition,
  fetchStakingStats,
  notifyStakeSuccess,
} from "@/lib/staking/staking.client";
import {
  fetchMedusaWalletBalance,
  formatStakeInputAmount,
  stakeAmountFromBalancePercent,
} from "@/lib/staking/medusaBalance.client";
import { isStreamflowStakingConfigured } from "@/lib/staking/streamflowPools";
import type {
  StakingGlobalStats,
  StakingUserPosition,
} from "@/lib/staking/types";
import { getSolanaExplorerUrl } from "@/lib/passport/config";
import type { SignerWalletAdapter } from "@solana/wallet-adapter-base";

const EMPTY_STATS: StakingGlobalStats = {
  activeStakers: 0,
  totalStakedMedusa: "0",
  totalBuybacksMedusa: "0",
  totalRewardsClaimedMedusa: "0",
  pendingRewardPoolMedusa: "0",
  lastDripAt: null,
  nextDripAt: null,
  configured: isStreamflowStakingConfigured(),
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-white/15 bg-[#0a0a0a] p-4 space-y-1">
      <p className="font-['PerfectDOS'] text-[10px] uppercase text-white/40">
        {label}
      </p>
      <p className="font-['PerfectDOS'] text-lg text-white normal-case">
        {value}
      </p>
      {hint ? (
        <p className="font-['PerfectDOS'] text-[11px] text-white/45 normal-case">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PanelButton({
  children,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full md:w-auto px-6 py-3 border font-['PerfectDOS'] uppercase text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        accent
          ? "border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37]/10"
          : "border-white text-white hover:bg-white hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function formatStreamflowError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("blocked") ||
      message.includes("malicious") ||
      message.includes("blowfish")
    ) {
      return "Phantom blocked this request (Blowfish security). Tap “Proceed anyway” if you trust zkmedusa.com, or use another wallet. We’re requesting a whitelist from Blowfish.";
    }
    return error.message;
  }
  return "Transaction failed. Try again.";
}

export default function StakingFlow() {
  const { connection } = useConnection();
  const { publicKey, wallet, sendTransaction } = useWallet();
  const walletAdapter = wallet?.adapter as SignerWalletAdapter | undefined;
  const toast = useToast();
  const mint = getMedusaMintAddress();

  const [stats, setStats] = useState<StakingGlobalStats>(EMPTY_STATS);
  const [position, setPosition] = useState<StakingUserPosition | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPosition, setLoadingPosition] = useState(false);
  const [selectedLockDays, setSelectedLockDays] = useState(30);
  const [stakeAmount, setStakeAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "stake" | "claim" | "unstake" | null
  >(null);

  const refreshStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const nextStats = await fetchStakingStats();
      setStats(nextStats);
    } catch (error) {
      console.error(error);
      toast.error("Could not load staking stats.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const refreshPosition = useCallback(async () => {
    if (!publicKey) {
      setPosition(null);
      return;
    }

    setLoadingPosition(true);
    try {
      const nextPosition = await fetchStakingPosition(publicKey.toBase58());
      setPosition(nextPosition);
    } catch (error) {
      console.error(error);
      toast.error("Could not load your staking position.");
    } finally {
      setLoadingPosition(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void (async () => {
      await refreshStats();
      await refreshPosition();
    })();
  }, [refreshStats, refreshPosition]);

  const refreshWalletBalance = useCallback(async () => {
    if (!publicKey) {
      setWalletBalance(null);
      return;
    }

    setLoadingBalance(true);
    try {
      const balance = await fetchMedusaWalletBalance(connection, publicKey);
      setWalletBalance(balance);
    } catch (error) {
      console.error(error);
      setWalletBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refreshWalletBalance();
  }, [refreshWalletBalance]);

  const applyStakePercent = (percent: number) => {
    if (walletBalance === null || walletBalance <= 0) {
      return;
    }
    setStakeAmount(stakeAmountFromBalancePercent(walletBalance, percent));
  };

  const formattedWalletBalance =
    walletBalance === null
      ? "—"
      : `${formatMedusaAmount(formatStakeInputAmount(walletBalance))} $MEDUSA`;

  const canQuickFill =
    publicKey !== null && walletBalance !== null && walletBalance > 0;

  const selectedTier = STAKING_LOCK_TIERS.find(
    (tier) => tier.days === selectedLockDays,
  );

  const claimableTotal = useMemo(
    () => Number.parseFloat(position?.claimableMedusa ?? "0"),
    [position?.claimableMedusa],
  );

  const canStake =
    Boolean(publicKey && walletAdapter && sendTransaction) &&
    stakeAmount.trim().length > 0 &&
    stats.configured &&
    busyAction === null;

  const canClaim =
    Boolean(publicKey && walletAdapter && sendTransaction) &&
    claimableTotal > 0 &&
    busyAction === null;

  const handleStake = async () => {
    if (!walletAdapter || !sendTransaction || !publicKey) {
      return;
    }

    setBusyAction("stake");
    toast.info("Confirm the stake transaction in your wallet…");

    const confirmedAmount = stakeAmount;

    try {
      const { stakeMedusa } = await import(
        "@/lib/staking/streamflowActions.client"
      );
      const signature = await stakeMedusa({
        wallet: walletAdapter,
        publicKey,
        connection,
        sendTransaction,
        tierDays: selectedLockDays,
        amount: stakeAmount,
      });
      setStakeAmount("");
      toast.success(`Staked successfully. Tx: ${signature.slice(0, 8)}…`);
      void notifyStakeSuccess({
        signature,
        wallet: publicKey.toBase58(),
        tierDays: selectedLockDays,
        amount: confirmedAmount,
      });
      await Promise.all([
        refreshStats(),
        refreshPosition(),
        refreshWalletBalance(),
      ]);
    } catch (error) {
      toast.error(formatStreamflowError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleClaim = async () => {
    if (!walletAdapter || !publicKey || !position?.positions.length) {
      return;
    }

    setBusyAction("claim");
    toast.info("Confirm the claim transaction in your wallet…");

    try {
      const { claimAllStakingRewards } = await import(
        "@/lib/staking/streamflowActions.client"
      );
      const signature = await claimAllStakingRewards({
        wallet: walletAdapter,
        publicKey,
        connection,
        sendTransaction,
        positions: position.positions,
      });
      toast.success(`Rewards claimed. Tx: ${signature.slice(0, 8)}…`);
      await Promise.all([refreshStats(), refreshPosition()]);
    } catch (error) {
      toast.error(formatStreamflowError(error));
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnstake = async (stakeEntry: string) => {
    if (!walletAdapter || !sendTransaction || !publicKey || !position) {
      return;
    }

    const tierPosition = position.positions.find(
      (entry) => entry.stakeEntry === stakeEntry,
    );
    if (!tierPosition) {
      return;
    }

    setBusyAction("unstake");
    toast.info("Confirm unstake in your wallet…");

    try {
      const { unstakeTier } = await import(
        "@/lib/staking/streamflowActions.client"
      );
      const signature = await unstakeTier({
        wallet: walletAdapter,
        publicKey,
        connection,
        sendTransaction,
        position: tierPosition,
      });
      toast.success(`Unstaked successfully. Tx: ${signature.slice(0, 8)}…`);
      await Promise.all([refreshStats(), refreshPosition()]);
    } catch (error) {
      toast.error(formatStreamflowError(error));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <header className="space-y-4 text-center md:text-left">
        <p className="font-['BlueScreen'] text-xs uppercase tracking-widest text-[#d4af37]">
          // $MEDUSA · Staking
        </p>
        <h1 className="font-['PerfectDOS'] text-2xl md:text-3xl text-white uppercase">
          Stake $MEDUSA · Claim revenue
        </h1>
        <p className="font-['PerfectDOS'] text-sm text-white/70 normal-case leading-relaxed max-w-2xl">
          Stake into fixed-lock Streamflow pools (7 / 30 / 90 / 180 days). Revenue
          buybacks will fund reward pools daily — automatic top-ups ship next.
          Rewards are claimed manually in $MEDUSA.
        </p>
        <div className="space-y-2">
          <a
            href="https://streamflow.finance"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto inline-flex items-center gap-2.5 transition-opacity hover:opacity-80 md:mx-0"
          >
            <span className="font-sans text-xs text-white/50 normal-case tracking-wide">
              Powered by
            </span>
            <StreamflowLogo />
          </a>
          <a
            href={getSolanaExplorerUrl(mint)}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto block w-fit font-['PerfectDOS'] text-[11px] text-white/50 hover:text-white underline normal-case md:mx-0"
          >
            Token: {mint.slice(0, 8)}…{mint.slice(-6)} ↗
          </a>
        </div>
      </header>

      {!stats.configured ? (
        <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 font-['PerfectDOS'] text-xs text-red-100/90 normal-case">
          Streamflow pool addresses are missing from the environment. Set the
          NEXT_PUBLIC_STREAMFLOW_* variables before enabling staking.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active stakers"
          value={
            loadingStats ? "…" : stats.activeStakers.toLocaleString()
          }
        />
        <StatCard
          label="Total staked"
          value={
            loadingStats
              ? "…"
              : `${formatMedusaAmount(stats.totalStakedMedusa)} $MEDUSA`
          }
        />
        <StatCard
          label="Reward pool funded"
          value={
            loadingStats
              ? "…"
              : `${formatMedusaAmount(stats.pendingRewardPoolMedusa)} $MEDUSA`
          }
          hint="In fund-delegate top-ups"
        />
        <StatCard
          label="Total buybacks"
          value={
            loadingStats
              ? "…"
              : `${formatMedusaAmount(stats.totalBuybacksMedusa)} $MEDUSA`
          }
        />
        <StatCard
          label="Rewards claimed"
          value={
            loadingStats
              ? "…"
              : `${formatMedusaAmount(stats.totalRewardsClaimedMedusa)} $MEDUSA`
          }
        />
        <StatCard
          label="Next pool top-up"
          value={
            loadingStats
              ? "…"
              : stats.nextDripAt
                ? formatDateTime(stats.nextDripAt)
                : "—"
          }
          hint={
            stats.lastDripAt
              ? `Last top-up ${formatDateTime(stats.lastDripAt)}`
              : `Buybacks every ${DRIP_INTERVAL_MINUTES} min`
          }
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="border border-white/15 bg-[#0a0a0a] p-6 space-y-4">
          <h2 className="font-['PerfectDOS'] text-sm text-white uppercase">
            Revenue flywheel
          </h2>
          <ul className="space-y-3 font-['PerfectDOS'] text-xs text-white/70 normal-case leading-relaxed">
            <li>
              <span className="text-white">
                {formatPercent(PUMPFUN_DEV_FEE_BUYBACK_PERCENT)} of Pump.fun dev
                fees
              </span>{" "}
              → SOL to dev wallet → global $MEDUSA buyback → tier top-up accounts.
            </li>
            <li>
              <span className="text-white">
                {formatPercent(PASSPORT_USDC_BUYBACK_PERCENT)} of passport x402
                USDC
              </span>{" "}
              ({formatPercent(PASSPORT_USDC_TO_SOL_PERCENT)} converted to SOL
              first) → dev wallet → same buyback path.
            </li>
            <li>
              Each tier has its own Streamflow pool. Longer locks receive a
              larger share of each buyback (10 / 15 / 25 / 50%).
            </li>
          </ul>
        </div>

        <div className="border border-white/15 bg-[#0a0a0a] p-6 space-y-4">
          <h2 className="font-['PerfectDOS'] text-sm text-white uppercase">
            Lock tiers
          </h2>
          <p className="font-['PerfectDOS'] text-xs text-white/60 normal-case">
            Each tier is a separate on-chain pool with a fixed lock duration.
          </p>
          <div className="grid gap-2">
            {STAKING_LOCK_TIERS.map((tier) => (
              <div
                key={tier.days}
                className="flex items-center justify-between border border-white/10 px-3 py-2 font-['PerfectDOS'] text-xs normal-case"
              >
                <span className="text-white">{tier.label}</span>
                <span className="text-[#d4af37]">
                  {formatPercent(tier.multiplierPercent)} of buyback slice
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border border-white/15 bg-[#0a0a0a] p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="font-['PerfectDOS'] text-lg text-white uppercase">
            Your position
          </h2>
          <p className="font-['PerfectDOS'] text-xs text-white/60 normal-case">
            Connect a Solana wallet to stake $MEDUSA and accrue claimable
            rewards.
          </p>
        </div>

        <WalletConnectButton />

        {publicKey && loadingPosition ? (
          <p className="font-['PerfectDOS'] text-xs text-white/50 normal-case">
            Loading on-chain position…
          </p>
        ) : null}

        {position && Number.parseFloat(position.stakedMedusa) > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-['PerfectDOS'] text-xs normal-case">
              <div className="border border-white/10 p-3 space-y-1">
                <p className="text-white/40 uppercase text-[10px]">Staked</p>
                <p className="text-white">
                  {formatMedusaAmount(position.stakedMedusa)} $MEDUSA
                </p>
              </div>
              <div className="border border-white/10 p-3 space-y-1">
                <p className="text-white/40 uppercase text-[10px]">Next unlock</p>
                <p className="text-white">
                  {position.lockExpiresAt
                    ? formatDateTime(position.lockExpiresAt)
                    : "—"}
                </p>
              </div>
              <div className="border border-white/10 p-3 space-y-1">
                <p className="text-white/40 uppercase text-[10px]">Positions</p>
                <p className="text-white">{position.positions.length}</p>
              </div>
              <div className="border border-white/10 p-3 space-y-1">
                <p className="text-white/40 uppercase text-[10px]">Claimable</p>
                <p className="text-[#d4af37]">
                  {formatMedusaAmount(position.claimableMedusa)} $MEDUSA
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {position.positions.map((tierPosition) => (
                <div
                  key={tierPosition.stakeEntry}
                  className="border border-white/10 px-3 py-3 font-['PerfectDOS'] text-xs normal-case flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-white">
                      {tierPosition.tierLabel} ·{" "}
                      {formatMedusaAmount(tierPosition.stakedMedusa)} $MEDUSA
                    </p>
                    <p className="text-white/50 mt-1">
                      Unlock {formatDateTime(tierPosition.lockExpiresAt)} ·
                      Claimable {formatMedusaAmount(tierPosition.claimableMedusa)}
                    </p>
                  </div>
                  {tierPosition.canUnstake ? (
                    <PanelButton
                      disabled={busyAction !== null}
                      onClick={() => void handleUnstake(tierPosition.stakeEntry)}
                    >
                      {busyAction === "unstake" ? "Unstaking…" : "Unstake"}
                    </PanelButton>
                  ) : (
                    <span className="text-white/40 uppercase text-[10px]">
                      Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : publicKey ? (
          <p className="font-['PerfectDOS'] text-xs text-white/50 normal-case">
            No active stake yet. Choose a tier below to stake $MEDUSA.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <PanelButton
            disabled={!canClaim}
            accent
            onClick={() => void handleClaim()}
          >
            {busyAction === "claim" ? "Claiming…" : "Claim rewards"}
          </PanelButton>
          {position && Number.parseFloat(position.totalClaimedMedusa) > 0 ? (
            <PanelButton disabled>
              Total claimed: {formatMedusaAmount(position.totalClaimedMedusa)}
            </PanelButton>
          ) : null}
        </div>
      </section>

      <section className="border border-white/15 bg-[#0a0a0a] p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <h2 className="font-['PerfectDOS'] text-lg text-white uppercase">
            Stake $MEDUSA
          </h2>
          <p className="font-['PerfectDOS'] text-xs text-white/60 normal-case">
            Choose a lock period, enter an amount, and stake. Unstake after the
            lock expires.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAKING_LOCK_TIERS.map((tier) => {
            const selected = tier.days === selectedLockDays;
            return (
              <button
                key={tier.days}
                type="button"
                onClick={() => setSelectedLockDays(tier.days)}
                className={`border p-4 text-left transition-colors font-['PerfectDOS'] text-xs normal-case ${
                  selected
                    ? "border-[#d4af37] bg-[#d4af37]/10 text-white"
                    : "border-white/15 text-white/70 hover:border-white/30"
                }`}
              >
                <p className="uppercase text-[10px] text-white/50">
                  Lock period
                </p>
                <p className="text-base text-white mt-1">{tier.label}</p>
                <p className="text-[#d4af37] mt-2">
                  {formatPercent(tier.multiplierPercent)} buyback slice
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 max-w-md">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="stake-amount"
              className="font-['PerfectDOS'] text-[10px] uppercase text-white/40"
            >
              Amount ($MEDUSA)
            </label>
            <p className="font-['PerfectDOS'] text-[11px] text-white/50 normal-case">
              {publicKey ? (
                loadingBalance ? (
                  "Balance: …"
                ) : (
                  <>Balance: {formattedWalletBalance}</>
                )
              ) : (
                "Connect wallet to detect balance"
              )}
            </p>
          </div>
          <input
            id="stake-amount"
            type="text"
            inputMode="decimal"
            value={stakeAmount}
            onChange={(event) => setStakeAmount(event.target.value)}
            placeholder="0.00"
            className="w-full bg-[#0d0d0d] border border-white/15 px-3 py-2 font-['PerfectDOS'] text-sm text-white placeholder:text-white/30"
          />
          <div className="flex flex-wrap gap-2">
            {[10, 25, 50].map((percent) => (
              <button
                key={percent}
                type="button"
                disabled={!canQuickFill || busyAction !== null}
                onClick={() => applyStakePercent(percent)}
                className="px-3 py-1.5 border border-white/15 font-['PerfectDOS'] text-[11px] uppercase text-white/70 transition-colors hover:border-[#d4af37] hover:text-[#d4af37] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {percent}%
              </button>
            ))}
            <button
              type="button"
              disabled={!canQuickFill || busyAction !== null}
              onClick={() => applyStakePercent(100)}
              className="px-3 py-1.5 border border-[#d4af37]/40 font-['PerfectDOS'] text-[11px] uppercase text-[#d4af37] transition-colors hover:bg-[#d4af37]/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Max
            </button>
          </div>
          {selectedTier && stakeAmount ? (
            <p className="font-['PerfectDOS'] text-[11px] text-white/50 normal-case">
              Selected: {stakeAmount} $MEDUSA locked for {selectedTier.label} in
              the {selectedTier.label} Streamflow pool.
            </p>
          ) : null}
        </div>

        <PanelButton
          disabled={!canStake}
          accent
          onClick={() => void handleStake()}
        >
          {busyAction === "stake" ? "Staking…" : "Stake $MEDUSA"}
        </PanelButton>
      </section>
    </div>
  );
}
