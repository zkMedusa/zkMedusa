"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getPassportIssuePriceLabel,
  getPublicInputs,
  PASSPORT_REQUIREMENTS,
} from "@/lib/passport/config";
import { evaluateEligibility, randomFieldSecret } from "@/lib/passport/eligibility";
import { isDevModeEnabled } from "@/lib/passport/dev";
import {
  generatePassportProof,
  type GenerateProofResult,
} from "@/lib/passport/prover.client";
import { createPassportFetchWithPayment } from "@/lib/passport/x402.client";
import {
  fetchWalletWitness,
  formatVolumeInSol,
  formatWalletAgeDays,
  getWitnessSummary,
} from "@/lib/passport/witness";
import { downloadPassportCard } from "@/lib/passport/downloadCard";
import { formatPassportId } from "@/lib/passport/format";
import PassportVisualCard from "./PassportVisualCard";
import StepIndicator from "./StepIndicator";
import WalletConnectButton from "./WalletConnectButton";
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
  | "done";

function getOnboardingStep(phase: FlowPhase, eligible: boolean): number {
  switch (phase) {
    case "connect":
      return 1;
    case "scanning":
    case "review":
      return eligible ? 2 : 2;
    case "proving":
      return 3;
    case "paying":
    case "issuing":
      return 4;
    case "done":
      return 5;
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
  const { publicKey, signAllTransactions } = useWallet();
  const [phase, setPhase] = useState<FlowPhase>("connect");
  const [witness, setWitness] = useState<WalletWitness | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [proofResult, setProofResult] = useState<GenerateProofResult | null>(null);
  const [passport, setPassport] = useState<MedusaPassport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [proofSecret] = useState(() => randomFieldSecret());
  const cardRef = useRef<HTMLDivElement>(null);

  const publicInputs = useMemo(
    () => getPublicInputs(Math.floor(Date.now() / 1000)),
    [],
  );

  const issuePriceLabel = useMemo(() => getPassportIssuePriceLabel(), []);

  const onboardingStep = getOnboardingStep(
    phase,
    eligibility?.eligible ?? false,
  );

  useEffect(() => {
    if (publicKey && phase === "connect") {
      setError(null);
    }
  }, [publicKey, phase]);

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
    setPhase("proving");

    try {
      const nextProof = await generatePassportProof({
        witness,
        tier: eligibility.tier,
        publicInputs,
        secret: proofSecret,
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
    }
  }, [eligibility, proofSecret, publicInputs, witness]);

  const payAndIssue = useCallback(async () => {
    if (!publicKey || !witness || !eligibility?.tier || !signAllTransactions) {
      return;
    }

    setError(null);
    setPhase("paying");

    try {
      let activeProof = proofResult;
      if (!activeProof) {
        setPhase("issuing");
        activeProof = await generatePassportProof({
          witness,
          tier: eligibility.tier,
          publicInputs,
          secret: proofSecret,
        });
        setProofResult(activeProof);
      } else {
        setPhase("issuing");
      }

      const fetchWithPayment = createPassportFetchWithPayment(
        publicKey.toBase58(),
        signAllTransactions,
      );

      const response = await fetchWithPayment("/api/passport/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zkProof: activeProof.zkProof,
          nullifier: activeProof.nullifier,
          tier: eligibility.tier,
          publicInputs,
        }),
      });

      const payload = (await response.json()) as {
        passport?: MedusaPassport;
        error?: string;
      };

      if (!response.ok || !payload.passport) {
        throw new Error(payload.error ?? "Passport issuance failed.");
      }

      setPassport(payload.passport);
      setPhase("done");
    } catch (flowError) {
      setError(
        flowError instanceof Error ? flowError.message : "Passport flow failed.",
      );
      setPhase("paying");
    }
  }, [
    eligibility,
    proofResult,
    proofSecret,
    publicInputs,
    publicKey,
    signAllTransactions,
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
    <div className="min-h-screen w-full bg-black text-white flex items-stretch justify-between relative overflow-x-hidden">
      <img
        src="/pillar.gif"
        alt=""
        aria-hidden
        className="hidden md:block h-full min-h-screen object-cover w-[12%] lg:w-[15%] ml-0 lg:ml-10 py-4 md:py-8 shrink-0"
      />

      <div className="flex-1 min-w-0 px-4 py-10 md:py-14">
        <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-3 text-center md:text-left">
          <p className="font-['BlueScreen'] text-2xl md:text-4xl">
            &#47;&#47; MEDUSA PASSPORT
          </p>
          <p className="font-['PerfectDOS'] text-sm text-white/60 normal-case leading-relaxed">
            Five steps to mint your privacy passport. Your wallet address never
            leaves your device.
          </p>
        </header>

        <StepIndicator currentStep={onboardingStep} />

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

        {/* Step 1 — Connect */}
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

        {/* Step 2 — Scanning */}
        {phase === "scanning" && (
          <StepCard
            step={2}
            title="Checking eligibility"
            description="Scanning wallet age, transaction count, and volume. This happens locally — nothing is sent to our servers."
          >
            <LoadingState message="Reading on-chain activity..." />
          </StepCard>
        )}

        {/* Step 2 — Review */}
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

        {/* Step 3 — Proving */}
        {phase === "proving" && (
          <StepCard
            step={3}
            title="Generating proof"
            description="Creating a zero-knowledge proof of your eligibility. Your wallet address is not included in the proof."
          >
            <LoadingState
              message={
                isDevModeEnabled()
                  ? "Creating local dev proof..."
                  : "Generating ZK proof in your browser..."
              }
            />
          </StepCard>
        )}

        {/* Step 4 — Pay */}
        {phase === "paying" && (
          <StepCard
            step={4}
            title="Mint passport"
            description={`Pay ${issuePriceLabel} USDC via x402 to receive your signed Medusa Passport. Valid for 90 days.`}
          >
            <div className="space-y-4">
              {eligibility?.tierLabel && (
                <p className="font-['PerfectDOS'] text-sm text-white/80 normal-case">
                  Tier: <span className="text-white">{eligibility.tierLabel}</span>
                </p>
              )}
              <PrimaryButton onClick={payAndIssue}>
                Pay {issuePriceLabel} USDC & mint →
              </PrimaryButton>
            </div>
          </StepCard>
        )}

        {/* Step 4 — Issuing */}
        {phase === "issuing" && (
          <StepCard
            step={4}
            title="Issuing passport"
            description="x402 payment confirmed. Signing and delivering your passport..."
          >
            <LoadingState message="Issuing your Medusa Passport..." />
          </StepCard>
        )}

        {/* Step 5 — Done */}
        {phase === "done" && passport && (
          <StepCard
            step={5}
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
        </div>
      </div>

      <img
        src="/pillar.gif"
        alt=""
        aria-hidden
        className="hidden md:block h-full min-h-screen object-cover w-[12%] lg:w-[15%] mr-0 lg:mr-10 py-4 md:py-8 shrink-0"
      />
    </div>
  );
}
