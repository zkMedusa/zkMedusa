"use client";

import {
  Barretenberg,
  BackendType,
  UltraHonkBackend,
} from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { getPublicInputs } from "./config";
import {
  assertCircuitWitness,
  deriveNullifier,
  hashPublicInputs,
} from "./eligibility";
import { normalizeCompiledCircuit } from "./circuit";
import { createDevProofBundle, isDevModeEnabled } from "./dev";
import type {
  PassportPublicInputs,
  WalletWitness,
  ZkProofBundle,
} from "./types";
import type { PassportTier } from "./config";

import type { CompiledCircuit } from "@noir-lang/types";

export type ProofProgressStep =
  | "loading-runtime"
  | "loading-circuit"
  | "executing-circuit"
  | "initializing-prover"
  | "generating-proof";

const PROOF_TIMEOUT_MS = 15 * 60 * 1000;

let noirInitPromise: Promise<void> | null = null;
let barretenbergPromise: Promise<Barretenberg> | null = null;
let cachedCircuit: CompiledCircuit | null = null;

async function ensureNoirInitialized(): Promise<void> {
  if (noirInitPromise) {
    return noirInitPromise;
  }

  noirInitPromise = (async () => {
    const [{ default: initNoirC }, { default: initACVM }] = await Promise.all([
      import("@noir-lang/noirc_abi"),
      import("@noir-lang/acvm_js"),
    ]);

    const [acvmResponse, noircResponse] = await Promise.all([
      fetch("/wasm/acvm_js_bg.wasm"),
      fetch("/wasm/noirc_abi_wasm_bg.wasm"),
    ]);

    if (!acvmResponse.ok || !noircResponse.ok) {
      throw new Error(
        "ZK runtime failed to load. Refresh the page or redeploy — WASM files may be missing.",
      );
    }

    await Promise.all([
      initACVM(acvmResponse),
      initNoirC(noircResponse),
    ]);
  })();

  return noirInitPromise;
}

async function getBarretenberg(): Promise<Barretenberg> {
  if (!barretenbergPromise) {
    barretenbergPromise = Barretenberg.new({
      threads: 1,
      backend: BackendType.Wasm,
    });
  }

  return barretenbergPromise;
}

async function loadCircuit(): Promise<CompiledCircuit> {
  if (cachedCircuit) {
    return cachedCircuit;
  }

  const response = await fetch("/circuits/passport.json");
  if (!response.ok) {
    throw new Error(
      "ZK circuit not compiled yet. Deploy on Vercel to compile automatically, or run `npm run compile:circuit` on Linux/macOS.",
    );
  }

  cachedCircuit = normalizeCompiledCircuit(await response.json());
  return cachedCircuit;
}

export interface GenerateProofInput {
  witness: WalletWitness;
  tier: PassportTier;
  secret: string;
  onProgress?: (step: ProofProgressStep) => void;
}

export interface GenerateProofResult {
  zkProof: ZkProofBundle;
  nullifier: string;
  publicInputs: PassportPublicInputs;
}

export async function generatePassportProof(
  input: GenerateProofInput,
): Promise<GenerateProofResult> {
  return withTimeout(
    generatePassportProofInternal(input),
    PROOF_TIMEOUT_MS,
    "Proof generation timed out. Try again on a faster connection or desktop browser.",
  );
}

async function generatePassportProofInternal(
  input: GenerateProofInput,
): Promise<GenerateProofResult> {
  const report = (step: ProofProgressStep) => {
    input.onProgress?.(step);
  };

  const publicInputs = getPublicInputs(input.witness.fetchedAt);
  assertCircuitWitness(input.witness, input.tier, publicInputs);

  const nullifierHash = hashPublicInputs({
    ...publicInputs,
    tier: input.tier,
  });
  const nullifier = deriveNullifier(input.secret, nullifierHash);

  const circuitAvailable = await isCircuitAvailable();
  if (!circuitAvailable) {
    if (!isDevModeEnabled()) {
      throw new Error(
        "ZK circuit not compiled yet. Deploy on Vercel to compile automatically, or enable NEXT_PUBLIC_PASSPORT_DEV_MODE=true for local testing.",
      );
    }

    return {
      nullifier,
      publicInputs,
      zkProof: createDevProofBundle(input.tier),
    };
  }

  report("loading-runtime");
  await ensureNoirInitialized();

  report("loading-circuit");
  const circuit = await loadCircuit();
  const noir = new Noir(circuit);

  report("executing-circuit");
  let witness: Uint8Array;
  try {
    ({ witness } = await noir.execute({
      first_tx_timestamp: input.witness.firstTxTimestamp.toString(),
      tx_count: input.witness.transactionCount.toString(),
      volume_lamports: input.witness.volumeLamports.toString(),
      secret: toNoirFieldInput(input.secret),
      current_timestamp: publicInputs.current_timestamp.toString(),
      min_age_seconds: publicInputs.min_age_seconds.toString(),
      min_tx_count: publicInputs.min_tx_count.toString(),
      bronze_threshold: publicInputs.bronze_threshold.toString(),
      silver_threshold: publicInputs.silver_threshold.toString(),
      gold_threshold: publicInputs.gold_threshold.toString(),
      tier: input.tier.toString(),
    }));
  } catch (error) {
    throw formatProverError(error, "executing-circuit");
  }

  report("initializing-prover");
  const bb = await getBarretenberg();
  const backend = new UltraHonkBackend(circuit.bytecode, bb);

  report("generating-proof");
  let proofData;
  try {
    proofData = await backend.generateProof(witness);
  } catch (error) {
    throw formatProverError(error, "generating-proof");
  }

  return {
    nullifier,
    publicInputs,
    zkProof: {
      proofType: "noir_ultrahonk",
      proof: uint8ArrayToBase64(new Uint8Array(proofData.proof)),
      publicInputs: proofData.publicInputs,
    },
  };
}

type EnrichedNoirError = Error & {
  noirCallStack?: string[];
};

function formatProverError(
  error: unknown,
  step: ProofProgressStep,
): Error {
  if (error instanceof Error) {
    const message = error.message;
    const noirCallStack = (error as EnrichedNoirError).noirCallStack;

    if (noirCallStack && noirCallStack.length > 0) {
      return new Error(
        `ZK circuit failed at ${noirCallStack.join(" ")}. Rescan your wallet and try again.`,
      );
    }

    if (message.includes("Circuit execution failed")) {
      return new Error(
        `${message}. Rescan your wallet and try again.`,
      );
    }

    if (message.includes("unreachable")) {
      if (step === "executing-circuit") {
        return new Error(
          "ZK circuit rejected the wallet data. Rescan your wallet and try again.",
        );
      }

      return new Error(
        "ZK prover failed in the browser (often memory limits). Try desktop Chrome with fewer tabs open.",
      );
    }

    return error;
  }

  return new Error(String(error));
}

function toNoirFieldInput(value: string): string {
  if (value.startsWith("0x")) {
    return value;
  }

  return `0x${BigInt(value).toString(16)}`;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function isCircuitAvailable(): Promise<boolean> {
  return fetch("/circuits/passport.json", { method: "HEAD" })
    .then((response) => response.ok)
    .catch(() => false);
}

export function preloadPassportProver(): void {
  if (isDevModeEnabled()) {
    return;
  }

  void isCircuitAvailable().then((available) => {
    if (!available) {
      return;
    }

    void ensureNoirInitialized().catch(() => undefined);
    void getBarretenberg().catch(() => undefined);
    void loadCircuit().catch(() => undefined);
  });
}
