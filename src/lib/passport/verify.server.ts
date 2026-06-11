import { UltraHonkBackend } from "@aztec/bb.js";
import fs from "node:fs";
import path from "node:path";
import { ensureServerBarretenberg } from "./barretenberg.server";
import { normalizeCompiledCircuit } from "./circuit";
import type { ZkProofBundle } from "./types";
import type { CompiledCircuit } from "@noir-lang/types";

let circuitCache: CompiledCircuit | null = null;

const CIRCUIT_DISK_PATHS = [
  path.join(process.cwd(), "public", "circuits", "passport.json"),
  path.join(
    process.cwd(),
    "src",
    "lib",
    "passport",
    "generated",
    "passport.circuit.json",
  ),
];

function getAppBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return null;
}

async function fetchCircuitFromAppUrl(): Promise<CompiledCircuit | null> {
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(`${baseUrl}/circuits/passport.json`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    return null;
  }

  return normalizeCompiledCircuit(await response.json());
}

async function loadCircuit(): Promise<CompiledCircuit> {
  if (circuitCache) {
    return circuitCache;
  }

  for (const circuitPath of CIRCUIT_DISK_PATHS) {
    if (!fs.existsSync(circuitPath)) {
      continue;
    }

    circuitCache = normalizeCompiledCircuit(
      JSON.parse(fs.readFileSync(circuitPath, "utf8")),
    );
    return circuitCache;
  }

  const remoteCircuit = await fetchCircuitFromAppUrl();
  if (remoteCircuit) {
    circuitCache = remoteCircuit;
    return circuitCache;
  }

  throw new Error(
    "Passport circuit is missing on the server. Ensure Vercel runs `npm run compile:circuit` during build.",
  );
}

export type VerifyProofResult =
  | { valid: true }
  | { valid: false; error: string };

function formatVerifyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Passport circuit is missing")) {
    return message;
  }

  if (message.includes("Invalid compiled circuit format")) {
    return `${message} Redeploy the app so the circuit is compiled on Vercel.`;
  }

  return `ZK verification error: ${message}`;
}

export async function verifyZkProofBundle(
  zkProof: ZkProofBundle,
): Promise<boolean> {
  if (zkProof.proofType !== "noir_ultrahonk") {
    return false;
  }

  const circuit = await loadCircuit();
  const bb = await ensureServerBarretenberg(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, bb);
  const proofBytes = Buffer.from(zkProof.proof, "base64");

  return backend.verifyProof({
    proof: new Uint8Array(proofBytes),
    publicInputs: zkProof.publicInputs,
  });
}

export async function verifyDevProofBundle(
  zkProof: ZkProofBundle,
  expectedTier: number,
): Promise<boolean> {
  if (process.env.PASSPORT_DEV_SKIP_ZK !== "true") {
    return false;
  }

  if (zkProof.proofType !== "dev_local") {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(zkProof.proof, "base64").toString("utf8"),
    ) as { tier: number };

    return payload.tier === expectedTier;
  } catch {
    return false;
  }
}

export async function verifySubmittedProof(
  zkProof: ZkProofBundle,
  expectedTier: number,
): Promise<VerifyProofResult> {
  if (zkProof.proofType === "dev_local") {
    const valid = await verifyDevProofBundle(zkProof, expectedTier);
    return valid
      ? { valid: true }
      : {
          valid: false,
          error:
            "Dev proof rejected. Set PASSPORT_DEV_SKIP_ZK=true on the server for local testing.",
        };
  }

  if (zkProof.proofType === "noir_ultrahonk") {
    try {
      const valid = await verifyZkProofBundle(zkProof);
      return valid
        ? { valid: true }
        : {
            valid: false,
            error:
              "The ZK proof did not verify. Rescan your wallet, regenerate the proof, and mint again.",
          };
    } catch (error) {
      return { valid: false, error: formatVerifyError(error) };
    }
  }

  return {
    valid: false,
    error: `Unsupported proof type "${zkProof.proofType}".`,
  };
}
