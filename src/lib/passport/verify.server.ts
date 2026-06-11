import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import fs from "node:fs";
import path from "node:path";
import { normalizeCompiledCircuit } from "./circuit";
import type { ZkProofBundle } from "./types";
import type { CompiledCircuit } from "@noir-lang/types";

let circuitCache: CompiledCircuit | null = null;

function loadCircuitFromDisk(): CompiledCircuit {
  if (circuitCache) {
    return circuitCache;
  }

  const circuitPath = path.join(
    process.cwd(),
    "public",
    "circuits",
    "passport.json",
  );

  if (!fs.existsSync(circuitPath)) {
    throw new Error(
      "Passport circuit is missing. Run `npm run compile:circuit` first.",
    );
  }

  circuitCache = normalizeCompiledCircuit(
    JSON.parse(fs.readFileSync(circuitPath, "utf8")),
  );
  return circuitCache;
}

export async function verifyZkProofBundle(
  zkProof: ZkProofBundle,
): Promise<boolean> {
  if (zkProof.proofType !== "noir_ultrahonk") {
    return false;
  }

  const circuit = loadCircuitFromDisk();
  const bb = await Barretenberg.new();
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
): Promise<boolean> {
  if (zkProof.proofType === "dev_local") {
    return verifyDevProofBundle(zkProof, expectedTier);
  }

  if (zkProof.proofType === "noir_ultrahonk") {
    try {
      return await verifyZkProofBundle(zkProof);
    } catch {
      return false;
    }
  }

  return false;
}
