"use client";

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import {
  deriveNullifier,
  hashPublicInputs,
} from "./eligibility";
import { createDevProofBundle, isDevModeEnabled } from "./dev";
import type {
  PassportPublicInputs,
  WalletWitness,
  ZkProofBundle,
} from "./types";
import type { PassportTier } from "./config";

import type { CompiledCircuit } from "@noir-lang/types";

let noirInitPromise: Promise<void> | null = null;

async function ensureNoirInitialized(): Promise<void> {
  if (noirInitPromise) {
    return noirInitPromise;
  }

  noirInitPromise = (async () => {
    const [{ default: initNoirC }, { default: initACVM }] = await Promise.all([
      import("@noir-lang/noirc_abi"),
      import("@noir-lang/acvm_js"),
    ]);

    await Promise.all([initNoirC(), initACVM()]);
  })();

  return noirInitPromise;
}

async function loadCircuit(): Promise<CompiledCircuit> {
  const response = await fetch("/circuits/passport.json");
  if (!response.ok) {
    throw new Error(
      "ZK circuit not compiled yet. Deploy on Vercel to compile automatically, or run `npm run compile:circuit` on Linux/macOS.",
    );
  }

  return response.json();
}

export interface GenerateProofInput {
  witness: WalletWitness;
  tier: PassportTier;
  publicInputs: PassportPublicInputs;
  secret: string;
}

export interface GenerateProofResult {
  zkProof: ZkProofBundle;
  nullifier: string;
}

export async function generatePassportProof(
  input: GenerateProofInput,
): Promise<GenerateProofResult> {
  const nullifierHash = hashPublicInputs({
    ...input.publicInputs,
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
      zkProof: createDevProofBundle(input.tier),
    };
  }

  await ensureNoirInitialized();
  const circuit = await loadCircuit();
  const noir = new Noir(circuit);
  const bb = await Barretenberg.new();
  const backend = new UltraHonkBackend(circuit.bytecode, bb);

  const { witness } = await noir.execute({
    first_tx_timestamp: input.witness.firstTxTimestamp.toString(),
    tx_count: input.witness.transactionCount.toString(),
    volume_lamports: input.witness.volumeLamports.toString(),
    secret: input.secret,
    current_timestamp: input.publicInputs.current_timestamp.toString(),
    min_age_seconds: input.publicInputs.min_age_seconds.toString(),
    min_tx_count: input.publicInputs.min_tx_count.toString(),
    bronze_threshold: input.publicInputs.bronze_threshold.toString(),
    silver_threshold: input.publicInputs.silver_threshold.toString(),
    gold_threshold: input.publicInputs.gold_threshold.toString(),
    tier: input.tier.toString(),
    nullifier: "0",
  });

  const proofData = await backend.generateProof(witness);
  const verified = await backend.verifyProof(proofData);

  if (!verified) {
    throw new Error("Generated proof failed local verification.");
  }

  return {
    nullifier,
    zkProof: {
      proofType: "noir_ultrahonk",
      proof: uint8ArrayToBase64(new Uint8Array(proofData.proof)),
      publicInputs: proofData.publicInputs,
    },
  };
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function isCircuitAvailable(): Promise<boolean> {
  return fetch("/circuits/passport.json", { method: "HEAD" })
    .then((response) => response.ok)
    .catch(() => false);
}
