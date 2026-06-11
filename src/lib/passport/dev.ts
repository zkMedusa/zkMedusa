import type { PassportTier } from "./config";
import type { ZkProofBundle } from "./types";

export function createDevProofBundle(tier: PassportTier): ZkProofBundle {
  const json = JSON.stringify({ tier });
  return {
    proofType: "dev_local",
    proof: btoa(json),
    publicInputs: [tier.toString()],
  };
}

export function isDevModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PASSPORT_DEV_MODE === "true";
}
