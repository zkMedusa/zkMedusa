import { UltraHonkBackend } from "@aztec/bb.js";
import fs from "node:fs";
import path from "node:path";
import { hexToBytes } from "./eligibility";
import { ensureServerBarretenberg } from "./barretenberg.server";
import { normalizeCompiledCircuit } from "./circuit";
import type { ZkProofBundle } from "./types";
import type { CompiledCircuit } from "@noir-lang/types";

const DEFAULT_VERIFY_SETTINGS = {
  ipaAccumulation: false,
  oracleHashType: "poseidon2",
  disableZk: false,
  optimizedSolidityVerifier: false,
} as const;

let circuitCache: CompiledCircuit | null = null;
let cachedVerificationKey: Uint8Array | null = null;

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

async function getVerificationKey(
  circuit: CompiledCircuit,
): Promise<Uint8Array> {
  if (cachedVerificationKey) {
    return cachedVerificationKey;
  }

  const bb = await ensureServerBarretenberg(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode, bb);
  cachedVerificationKey = await backend.getVerificationKey();
  return cachedVerificationKey;
}

export async function verifyZkProofBundle(
  zkProof: ZkProofBundle,
): Promise<boolean> {
  if (zkProof.proofType !== "noir_ultrahonk") {
    return false;
  }

  const circuit = loadCircuitFromDisk();
  const bb = await ensureServerBarretenberg(circuit);
  const verificationKey = await getVerificationKey(circuit);
  const proofBytes = Buffer.from(zkProof.proof, "base64");
  const proofFrs: Uint8Array[] = [];

  for (let index = 0; index < proofBytes.length; index += 32) {
    proofFrs.push(proofBytes.subarray(index, index + 32));
  }

  const { verified } = await bb.circuitVerify({
    verificationKey,
    publicInputs: zkProof.publicInputs.map((input) => hexToBytes(input)),
    proof: proofFrs,
    settings: DEFAULT_VERIFY_SETTINGS,
  });

  return verified;
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
