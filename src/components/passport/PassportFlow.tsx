"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  getPassportIssuePriceLabel,
  isBadgeMintingEnabled,
  PASSPORT_REQUIREMENTS,
} from "@/lib/passport/config";
import {
  checkUsdcPaymentReadiness,
  formatPaymentError,
} from "@/lib/passport/usdc.client";
import { evaluateEligibility, randomFieldSecret } from "@/lib/passport/eligibility";
import { isDevModeEnabled } from "@/lib/passport/dev";
import {
  generatePassportProof,
  preloadPassportProver,
  type GenerateProofResult,
  type ProofProgressStep,
} from "@/lib/passport/prover.client";
import { readJsonResponse } from "@/lib/passport/http.client";
import { createPassportFetchWithPayment, fetchPassportIssueConfig } from "@/lib/passport/x402.client";
import {
  fetchWalletWitness,
  formatVolumeInSol,
  formatWalletAgeDays,
  getWitnessSummary,
} from "@/lib/passport/witness";
import { downloadPassportCard } from "@/lib/passport/downloadCard";
import { formatPassportId } from "@/lib/passport/format";
import {
  downloadClaimWalletBackup,
  generateClaimWalletKeypair,
  loadPassportFromSession,
  markClaimWalletBadge,
  saveClaimWallet,
  storePassportForWalletPage,
  type ClaimWalletBadge,
  type ClaimWalletRecord,
} from "@/lib/passport/claimWallet.client";
import ClaimWalletPanel from "./ClaimWalletPanel";
import PassportVisualCard from "./PassportVisualCard";
import StepIndicator, { type StepDefinition } from "./StepIndicator";
import StickyPillarLayout from "@/components/StickyPillarLayout";
import WalletConnectButton from "./WalletConnectButton";
import type { BadgeRecord } from "@/lib/passport/badge.server";
import type {
  EligibilityResult,
  MedusaPassport,
  WalletWitness,
} from "@/lib/passport/types";

type FlowPhase =
  | "connect"
  | "scanning"
  | "review"
  | "proving"
  | "paying"
  | "issuing"
  | "claim"
  | "badge"
  | "done";

function getOnboardingStep(phase: FlowPhase, badgeEnabled: boolean): number {
  const lastStep = badgeEnabled ? 6 : 5;

  switch (phase) {
    case "connect":
      return 1;
    case "scanning":
    case "review":
      return 2;
    case "proving":
      return 3;
    case "paying":
    case "issuing":
      return 4;
    case "claim":
      return 5;
    case "badge":
      return 6;
    case "done":
      // Past the last step so every circle renders as complete.
      return lastStep + 1;
    default:
      return 1;
  }
}

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/20 p-6 md:p-8 space-y-6 min-h-[280px] flex flex-col">
      <div className="space-y-2">
        <h2 className="text-xl md:text-2xl text-white">
          <span className="font-['BlueScreen']">&#47;&#47;</span>
          <span className="font-['PerfectDOS'] uppercase">
            {" "}
            Step {step} — {title}
          </span>
        </h2>
        <p className="font-['PerfectDOS'] text-sm text-white/70 leading-relaxed normal-case">
          {description}
        </p>
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full md:w-auto px-6 py-3 border border-white font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white"
    >
      {children}
    </button>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 font-['PerfectDOS'] text-sm text-white/70 normal-case">
      <span className="inline-block h-4 w-4 border border-white/40 border-t-white rounded-full animate-spin" />
      {message}
    </div>
  );
}

export default function PassportFlow() {
  const { connection } = useConnection();
  const { publicKey, signAllTransactions } = useWallet();
  const [phase, setPhase] = useState<FlowPhase>("connect");
  const [witness, setWitness] = useState<WalletWitness | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [proofResult, setProofResult] = useState<GenerateProofResult | null>(null);
  const [passport, setPassport] = useState<MedusaPassport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [proofProgress, setProofProgress] = useState<ProofProgressStep | null>(
    null,
  );
  const [proofSecret] = useState(() => randomFieldSecret());
  const [skipPayment, setSkipPayment] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [managePassport, setManagePassport] = useState<MedusaPassport | null>(
    null,
  );
  const [claimWalletRecord, setClaimWalletRecord] =
    useState<ClaimWalletRecord | null>(null);
  const [claimCopied, setClaimCopied] = useState(false);
  const [badge, setBadge] = useState<ClaimWalletBadge | null>(null);
  const [badgeBusy, setBadgeBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const issuePriceLabel = useMemo(() => getPassportIssuePriceLabel(), []);
  const badgeEnabled = useMemo(() => isBadgeMintingEnabled(), []);

  const flowSteps = useMemo<StepDefinition[]>(() => {
    const steps: StepDefinition[] = [
      { id: 1, label: "Connect" },
      { id: 2, label: "Verify" },
      { id: 3, label: "Prove" },
      { id: 4, label: "Mint" },
      { id: 5, label: "Wallet" },
    ];
    if (badgeEnabled) {
      steps.push({ id: 6, label: "Badge" });
    }
    return steps;
  }, [badgeEnabled]);

  const onboardingStep = getOnboardingStep(phase, badgeEnabled);

  useEffect(() => {
    preloadPassportProver();
  }, []);

  useEffect(() => {
    void fetchPassportIssueConfig()
      .then((config) => setSkipPayment(config.skipPayment))
      .catch(() => setSkipPayment(false));
  }, []);

  useEffect(() => {
    if (publicKey && phase === "connect") {
      setError(null);
    }
  }, [publicKey, phase]);

  const proofProgressMessage = useMemo(() => {
    if (isDevModeEnabled()) {
      return "Creating local dev proof...";
    }

    switch (proofProgress) {
      case "loading-runtime":
        return "Loading ZK runtime (first visit may take a moment)...";
      case "loading-circuit":
        return "Loading passport circuit...";
      case "executing-circuit":
        return "Running circuit witness...";
      case "initializing-prover":
        return "Downloading prover data (one-time, ~30–90s)...";
      case "generating-proof":
        return "Generating ZK proof (this can take 1–3 minutes)...";
      default:
        return "Preparing ZK proof in your browser...";
    }
  }, [proofProgress]);

  const scanWallet = useCallback(async () => {
    if (!publicKey) {
      return;
    }

    setError(null);
    setPhase("scanning");

    try {
      const nextWitness = await fetchWalletWitness(publicKey.toBase58());
      const nextEligibility = evaluateEligibility(nextWitness);
      setWitness(nextWitness);
      setEligibility(nextEligibility);
      setPhase("review");
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan wallet activity.",
      );
      setPhase("connect");
    }
  }, [publicKey]);

  const generateProof = useCallback(async () => {
    if (!witness || !eligibility?.tier) {
      return;
    }

    setError(null);
    setProofProgress(null);
    setPhase("proving");

    try {
      const nextProof = await generatePassportProof({
        witness,
        tier: eligibility.tier,
        secret: proofSecret,
        onProgress: setProofProgress,
      });
      setProofResult(nextProof);
      setPhase("paying");
    } catch (proveError) {
      setError(
        proveError instanceof Error
          ? proveError.message
          : "Unable to generate proof.",
      );
      setPhase("review");
    } finally {
      setProofProgress(null);
    }
  }, [eligibility, proofSecret, witness]);

  const payAndIssue = useCallback(async () => {
    if (!publicKey || !witness || !eligibility?.tier) {
      return;
    }

    if (!skipPayment && !signAllTransactions) {
      return;
    }

    setError(null);
    setPhase("paying");

    try {
      if (!skipPayment) {
        const readiness = await checkUsdcPaymentReadiness(connection, publicKey);
        if (!readiness.ready) {
          throw new Error(readiness.message);
        }
      }

      let activeProof = proofResult;
      if (!activeProof) {
        setPhase("issuing");
        activeProof = await generatePassportProof({
          witness,
          tier: eligibility.tier,
          secret: proofSecret,
          onProgress: setProofProgress,
        });
        setProofResult(activeProof);
      } else {
        setPhase("issuing");
      }

      const issueRequest = {
        method: "POST" as const,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zkProof: activeProof.zkProof,
          nullifier: activeProof.nullifier,
          tier: eligibility.tier,
          publicInputs: activeProof.publicInputs,
        }),
      };

      const response = skipPayment
        ? await fetch("/api/passport/issue", issueRequest)
        : await createPassportFetchWithPayment(
            publicKey.toBase58(),
            signAllTransactions!,
          )("/api/passport/issue", issueRequest);

      const payload = await readJsonResponse<{
        passport?: MedusaPassport;
        error?: string;
      }>(response);

      if (!response.ok || !payload.passport) {
        throw new Error(payload.error ?? "Passport issuance failed.");
      }

      setPassport(payload.passport);
      storePassportForWalletPage(payload.passport);
      setPhase("claim");
    } catch (flowError) {
      setError(formatPaymentError(flowError));
      setPhase("paying");
    }
  }, [
    connection,
    eligibility,
    proofResult,
    proofSecret,
    publicKey,
    signAllTransactions,
    skipPayment,
    witness,
  ]);

  const copyPassport = useCallback(async () => {
    if (!passport) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(passport, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [passport]);

  const createClaimWallet = useCallback(() => {
    if (!passport) {
      return;
    }

    setError(null);
    const generated = generateClaimWalletKeypair();
    const record = saveClaimWallet(passport.nullifier, generated);
    setClaimWalletRecord(record);
  }, [passport]);

  const copyClaimAddress = useCallback(async () => {
    if (!claimWalletRecord) {
      return;
    }
    await navigator.clipboard.writeText(claimWalletRecord.publicKey);
    setClaimCopied(true);
    window.setTimeout(() => setClaimCopied(false), 1500);
  }, [claimWalletRecord]);

  const continueToBadge = useCallback(() => {
    setError(null);
    setPhase(badgeEnabled ? "badge" : "done");
  }, [badgeEnabled]);

  const mintBadge = useCallback(async () => {
    if (!passport || !claimWalletRecord) {
      return;
    }

    setBadgeBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/passport/badge/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport,
          claimWallet: claimWalletRecord.publicKey,
        }),
      });

      const payload = await readJsonResponse<{
        minted?: boolean;
        badge?: BadgeRecord;
        error?: string;
      }>(response);

      if (!response.ok || !payload.minted || !payload.badge) {
        throw new Error(payload.error ?? "Soulbound badge mint failed.");
      }

      const nextBadge: ClaimWalletBadge = {
        assetId: payload.badge.assetId,
        explorerUrl: payload.badge.explorerUrl,
        tierLabel: payload.badge.tierLabel,
        mintedAt: payload.badge.mintedAt,
      };
      markClaimWalletBadge(claimWalletRecord.id, nextBadge);
      setBadge(nextBadge);
      setPhase("done");
    } catch (mintError) {
      setError(
        mintError instanceof Error
          ? mintError.message
          : "Unable to mint soulbound badge.",
      );
    } finally {
      setBadgeBusy(false);
    }
  }, [claimWalletRecord, passport]);

  const enterManageMode = useCallback(() => {
    try {
      const raw = loadPassportFromSession();
      if (raw) {
        const parsed = JSON.parse(raw) as MedusaPassport;
        if (parsed.type === "medusa_passport_v1") {
          setManagePassport(parsed);
        }
      }
    } catch {
      setManagePassport(null);
    }
    setManageMode(true);
  }, []);

  const downloadVisualPassport = useCallback(async () => {
    if (!passport || !cardRef.current) {
      return;
    }

    setDownloading(true);
    try {
      await downloadPassportCard(cardRef.current, passport);
    } catch {
      setError("Unable to download passport image. Try again.");
    } finally {
      setDownloading(false);
    }
  }, [passport]);

  return (
    <StickyPillarLayout>
        <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3 text-center md:text-left">
          <p className="font-['BlueScreen'] text-2xl md:text-4xl">
            &#47;&#47; MEDUSA PASSPORT
          </p>
          <p className="font-['PerfectDOS'] text-sm text-white/60 normal-case leading-relaxed">
            Mint your privacy passport, spin up a fresh claim wallet, and mint a
            soulbound on-chain badge — all in one place. Your wallet address
            never leaves your device.
          </p>
        </header>

        {manageMode ? (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => setManageMode(false)}
              className="font-['PerfectDOS'] text-xs uppercase text-white/50 hover:text-white transition-colors"
            >
              ← Back to passport minting
            </button>
            <ClaimWalletPanel
              passport={managePassport}
              onPassportLoad={setManagePassport}
            />
            <Link
              href="/docs"
              className="inline-flex items-center px-6 py-3 border border-white/40 font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
            >
              SDK docs →
            </Link>
          </div>
        ) : (
          <>
        <StepIndicator currentStep={onboardingStep} steps={flowSteps} />

        {phase === "connect" && (
          <p className="font-['PerfectDOS'] text-center text-xs text-white/40 normal-case">
            Already have a passport?{" "}
            <button
              type="button"
              onClick={enterManageMode}
              className="text-white/70 underline transition-colors hover:text-white"
            >
              Manage claim wallets & soulbound badge →
            </button>
          </p>
        )}

        {skipPayment && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 font-['PerfectDOS'] text-xs text-yellow-200/90 normal-case">
            Dev mode — x402 payment skipped. Set PASSPORT_DEV_SKIP_PAYMENT=false
            in production.
          </div>
        )}

        {isDevModeEnabled() && (
          <div className="border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 font-['PerfectDOS'] text-xs text-yellow-200/90 normal-case">
            Dev mode — ZK circuit fallback active for local testing.
          </div>
        )}

        {error && (
          <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 font-['PerfectDOS'] text-xs text-red-300 normal-case">
            {error}
          </div>
        )}

        {phase === "connect" && (
          <StepCard
            step={1}
            title="Connect wallet"
            description="Link your Solana wallet to begin. We only read public on-chain data locally in your browser."
          >
            <div className="space-y-6">
              <WalletConnectButton />
              {publicKey && (
                <PrimaryButton onClick={scanWallet}>
                  Continue to verification →
                </PrimaryButton>
              )}
            </div>
          </StepCard>
        )}

        {phase === "scanning" && (
          <StepCard
            step={2}
            title="Checking eligibility"
            description="Scanning wallet age, transaction count, and volume. This happens locally — nothing is sent to our servers."
          >
            <LoadingState message="Reading on-chain activity..." />
          </StepCard>
        )}

        {phase === "review" && witness && eligibility && (
          <StepCard
            step={2}
            title="Eligibility results"
            description={
              eligibility.eligible
                ? "You meet the requirements. Review your tier below, then generate your privacy proof."
                : "Your wallet does not meet the minimum requirements yet."
            }
          >
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3 font-['PerfectDOS'] text-xs normal-case">
                <div className="border border-white/15 p-3 space-y-1">
                  <p className="text-white/40 uppercase text-[10px]">Wallet age</p>
                  <p className="text-white">{formatWalletAgeDays(witness)} days</p>
                  <p className="text-white/40">
                    min {PASSPORT_REQUIREMENTS.minWalletAgeDays}d
                  </p>
                </div>
                <div className="border border-white/15 p-3 space-y-1">
                  <p className="text-white/40 uppercase text-[10px]">Transactions</p>
                  <p className="text-white">{witness.transactionCount}</p>
                  <p className="text-white/40">
                    min {PASSPORT_REQUIREMENTS.minTransactionCount}
                  </p>
                </div>
                <div className="border border-white/15 p-3 space-y-1">
                  <p className="text-white/40 uppercase text-[10px]">Volume (90d)</p>
                  <p className="text-white">{formatVolumeInSol(witness.volumeLamports)} SOL</p>
                  <p className="text-white/40">
                    tier: {eligibility.tierLabel ?? "—"}
                  </p>
                </div>
              </div>

              {!eligibility.eligible && (
                <ul className="space-y-1 font-['PerfectDOS'] text-xs text-red-300 normal-case">
                  {eligibility.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-3">
                {eligibility.eligible ? (
                  <PrimaryButton onClick={generateProof}>
                    Generate privacy proof →
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={scanWallet}>Retry scan</PrimaryButton>
                )}
              </div>
            </div>
          </StepCard>
        )}

        {phase === "proving" && (
          <StepCard
            step={3}
            title="Generating proof"
            description="Creating a zero-knowledge proof of your eligibility. Your wallet address is not included in the proof."
          >
            <LoadingState message={proofProgressMessage} />
          </StepCard>
        )}

        {phase === "paying" && (
          <StepCard
            step={4}
            title="Mint passport"
            description={
              skipPayment
                ? "Issue your signed Medusa Passport without x402 payment (dev only). Valid for 90 days."
                : `Pay ${issuePriceLabel} USDC via x402 to receive your signed Medusa Passport. Valid for 90 days.`
            }
          >
            <div className="space-y-4">
              {eligibility?.tierLabel && (
                <p className="font-['PerfectDOS'] text-sm text-white/80 normal-case">
                  Tier: <span className="text-white">{eligibility.tierLabel}</span>
                </p>
              )}
              <PrimaryButton onClick={payAndIssue}>
                {skipPayment
                  ? "Mint passport (no payment) →"
                  : `Pay ${issuePriceLabel} USDC & mint →`}
              </PrimaryButton>
              {!skipPayment && (
                <p className="font-['PerfectDOS'] text-center text-xs text-white/40 normal-case">
                  Powered by{" "}
                  <a
                    href="https://xpay.xona-agent.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/60 underline transition-colors hover:text-white"
                  >
                    xPay
                  </a>
                </p>
              )}
            </div>
          </StepCard>
        )}

        {phase === "issuing" && (
          <StepCard
            step={4}
            title="Issuing passport"
            description="x402 payment confirmed. Signing and delivering your passport..."
          >
            <LoadingState message="Issuing your Medusa Passport..." />
          </StepCard>
        )}

        {phase === "claim" && passport && (
          <StepCard
            step={5}
            title="Claim wallet"
            description="Generate a fresh wallet with no on-chain history. Use it for presales and allowlists so your proving wallet stays private."
          >
            <div className="space-y-5">
              {!claimWalletRecord ? (
                <PrimaryButton onClick={createClaimWallet}>
                  Generate claim wallet →
                </PrimaryButton>
              ) : (
                <div className="space-y-4">
                  <div className="border border-white/15 p-4 space-y-2">
                    <p className="font-['PerfectDOS'] text-[10px] uppercase text-white/40">
                      Your claim wallet
                    </p>
                    <p className="font-mono text-xs text-white break-all normal-case">
                      {claimWalletRecord.publicKey}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={copyClaimAddress}
                        className="px-4 py-2 border border-white/30 font-['PerfectDOS'] uppercase text-xs text-white/80 hover:border-white hover:text-white transition-colors"
                      >
                        {claimCopied ? "Copied" : "Copy address"}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadClaimWalletBackup(claimWalletRecord)}
                        className="px-4 py-2 border border-white/30 font-['PerfectDOS'] uppercase text-xs text-white/80 hover:border-white hover:text-white transition-colors"
                      >
                        Export backup
                      </button>
                    </div>
                  </div>
                  <div className="border border-yellow-500/20 bg-yellow-500/5 p-3 font-['PerfectDOS'] text-[11px] text-yellow-100/90 normal-case leading-relaxed">
                    Back up the secret offline now. Medusa never sees your secret
                    key — it stays in your browser until you export it.
                  </div>
                  <PrimaryButton onClick={continueToBadge}>
                    {badgeEnabled ? "Continue to badge →" : "Finish →"}
                  </PrimaryButton>
                </div>
              )}
              <button
                type="button"
                onClick={() => setPhase(badgeEnabled ? "badge" : "done")}
                className="font-['PerfectDOS'] text-xs uppercase text-white/40 hover:text-white transition-colors"
              >
                Skip for now →
              </button>
            </div>
          </StepCard>
        )}

        {phase === "badge" && passport && (
          <StepCard
            step={6}
            title="Soulbound badge"
            description="Mint a permanently-frozen MPL Core cNFT of your tier to the claim wallet. It can never be transferred, and Medusa mints it so your proving wallet stays unlinked."
          >
            <div className="space-y-5">
              {eligibility?.tierLabel && (
                <p className="font-['PerfectDOS'] text-sm text-white/80 normal-case">
                  Tier: <span className="text-white">{eligibility.tierLabel}</span>
                </p>
              )}
              {claimWalletRecord && (
                <p className="font-['PerfectDOS'] text-[11px] text-white/50 normal-case break-all">
                  Mints to: {claimWalletRecord.publicKey}
                </p>
              )}
              <PrimaryButton onClick={mintBadge} disabled={badgeBusy || !claimWalletRecord}>
                {badgeBusy ? "Minting..." : "Mint soulbound badge →"}
              </PrimaryButton>
              {!claimWalletRecord && (
                <p className="font-['PerfectDOS'] text-[11px] text-red-300 normal-case">
                  Generate a claim wallet first.
                </p>
              )}
              <button
                type="button"
                onClick={() => setPhase("done")}
                className="font-['PerfectDOS'] text-xs uppercase text-white/40 hover:text-white transition-colors"
              >
                Skip for now →
              </button>
            </div>
          </StepCard>
        )}

        {phase === "done" && passport && (
          <StepCard
            step={badgeEnabled ? 6 : 5}
            title="Passport ready"
            description="Your passport is issued. Download it or copy the JSON to use with partner apps via the SDK."
          >
            <div className="space-y-6">
              <div ref={cardRef} className="py-2">
                <PassportVisualCard passport={passport} />
              </div>

              <p className="font-['PerfectDOS'] text-xs text-white/50 text-center normal-case">
                Passport ID: {formatPassportId(passport.nullifier)}
              </p>

              {(claimWalletRecord || badge) && (
                <div className="border border-white/15 p-4 space-y-2 font-['PerfectDOS'] text-[11px] normal-case">
                  {claimWalletRecord && (
                    <div className="space-y-1">
                      <p className="text-white/40 uppercase text-[10px]">
                        Claim wallet
                      </p>
                      <p className="font-mono text-white/80 break-all">
                        {claimWalletRecord.publicKey}
                      </p>
                    </div>
                  )}
                  {badge && (
                    <div className="space-y-1 pt-1">
                      <p className="text-white/40 uppercase text-[10px]">
                        Soulbound badge ({badge.tierLabel})
                      </p>
                      <p className="font-mono text-white/80 break-all">
                        {badge.assetId}
                      </p>
                      <a
                        href={badge.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-white/60 underline hover:text-white"
                      >
                        View on explorer →
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <PrimaryButton
                  onClick={downloadVisualPassport}
                  disabled={downloading}
                >
                  {downloading ? "Downloading..." : "Download passport"}
                </PrimaryButton>
                <PrimaryButton onClick={copyPassport}>
                  {copied ? "Copied!" : "Copy JSON"}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={enterManageMode}
                  className="inline-flex items-center px-6 py-3 border border-white/40 font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
                >
                  Register for a campaign →
                </button>
                <Link
                  href="/docs"
                  className="inline-flex items-center px-6 py-3 border border-white/40 font-['PerfectDOS'] uppercase text-sm hover:bg-white hover:text-black transition-colors"
                >
                  SDK docs →
                </Link>
              </div>

              <details className="group">
                <summary className="font-['PerfectDOS'] text-xs text-white/40 uppercase cursor-pointer hover:text-white/70">
                  View raw JSON
                </summary>
                <textarea
                  readOnly
                  value={JSON.stringify(passport, null, 2)}
                  className="mt-3 w-full h-40 bg-[#0d0d0d] border border-white/15 p-3 font-mono text-[11px] text-white/80 normal-case"
                />
              </details>
            </div>
          </StepCard>
        )}

        <p className="font-['PerfectDOS'] text-[10px] text-white/30 text-center normal-case">
          {witness ? `Scan: ${getWitnessSummary(witness)}` : "Private by design — no wallet data stored"}
        </p>
          </>
        )}
        </div>
    </StickyPillarLayout>
  );
}
