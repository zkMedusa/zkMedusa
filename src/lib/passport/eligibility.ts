import { sha256 } from "@noble/hashes/sha2.js";
import {
  PASSPORT_REQUIREMENTS,
  PASSPORT_TIERS,
  TIER_LABELS,
  type PassportTier,
} from "./config";
import type {
  EligibilityResult,
  PassportPublicInputs,
  WalletWitness,
} from "./types";

function getTierFromVolume(volumeLamports: number): PassportTier | null {
  const thresholds = PASSPORT_REQUIREMENTS.tierVolumeThresholdsLamports;

  if (volumeLamports >= thresholds.gold) {
    return PASSPORT_TIERS.GOLD;
  }

  if (volumeLamports >= thresholds.silver) {
    return PASSPORT_TIERS.SILVER;
  }

  if (volumeLamports >= thresholds.bronze) {
    return PASSPORT_TIERS.BRONZE;
  }

  return null;
}

export function evaluateEligibility(witness: WalletWitness): EligibilityResult {
  const reasons: string[] = [];
  const minAgeSeconds = PASSPORT_REQUIREMENTS.minWalletAgeDays * 24 * 60 * 60;
  const walletAgeSeconds = witness.fetchedAt - witness.firstTxTimestamp;

  if (walletAgeSeconds < minAgeSeconds) {
    reasons.push(
      `Wallet age is ${Math.floor(walletAgeSeconds / 86400)} days. Minimum is ${PASSPORT_REQUIREMENTS.minWalletAgeDays} days.`,
    );
  }

  if (witness.transactionCount < PASSPORT_REQUIREMENTS.minTransactionCount) {
    reasons.push(
      `Transaction count is ${witness.transactionCount}. Minimum is ${PASSPORT_REQUIREMENTS.minTransactionCount}.`,
    );
  }

  const tier = getTierFromVolume(witness.volumeLamports);
  if (!tier) {
    reasons.push("Volume is below the bronze tier threshold.");
  }

  return {
    eligible: reasons.length === 0 && tier !== null,
    tier,
    tierLabel: tier ? TIER_LABELS[tier] : null,
    reasons,
    witness,
  };
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

/** BN254 scalar field modulus used by Noir / Barretenberg circuits. */
export const BN254_FIELD_MODULUS = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

export function randomFieldSecret(): string {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const candidate = BigInt(`0x${bytesToHex(bytes)}`);

    if (candidate === BigInt(0) || candidate >= BN254_FIELD_MODULUS) {
      continue;
    }

    return candidate.toString();
  }
}

export function hashString(value: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(value)));
}

export function deriveNullifier(
  secret: string,
  publicInputsHash: string,
): string {
  return hashString(`${secret}:${publicInputsHash}:medusa-nullifier`);
}

export function canonicalizePublicInputs(
  publicInputs: Record<string, number>,
): string {
  return JSON.stringify(
    Object.keys(publicInputs)
      .sort()
      .reduce<Record<string, number>>((accumulator, key) => {
        accumulator[key] = publicInputs[key];
        return accumulator;
      }, {}),
  );
}

export function hashPublicInputs(publicInputs: Record<string, number>): string {
  return hashString(canonicalizePublicInputs(publicInputs));
}

export function assertCircuitWitness(
  witness: WalletWitness,
  tier: PassportTier,
  publicInputs: PassportPublicInputs,
): void {
  const walletAgeSeconds =
    publicInputs.current_timestamp - witness.firstTxTimestamp;

  if (walletAgeSeconds < publicInputs.min_age_seconds) {
    throw new Error(
      `Wallet age (${Math.floor(walletAgeSeconds / 86400)} days) is below the minimum. Rescan your wallet and try again.`,
    );
  }

  if (witness.transactionCount < publicInputs.min_tx_count) {
    throw new Error(
      `Transaction count (${witness.transactionCount}) is below the minimum. Rescan your wallet and try again.`,
    );
  }

  const volume = witness.volumeLamports;
  const { bronze_threshold, silver_threshold, gold_threshold } = publicInputs;

  if (tier === PASSPORT_TIERS.GOLD) {
    if (volume < gold_threshold) {
      throw new Error(
        "Volume no longer meets gold tier requirements. Rescan your wallet and try again.",
      );
    }
    return;
  }

  if (tier === PASSPORT_TIERS.SILVER) {
    if (volume < silver_threshold || volume >= gold_threshold) {
      throw new Error(
        "Volume no longer meets silver tier requirements. Rescan your wallet and try again.",
      );
    }
    return;
  }

  if (tier === PASSPORT_TIERS.BRONZE) {
    if (volume < bronze_threshold || volume >= silver_threshold) {
      throw new Error(
        "Volume no longer meets bronze tier requirements. Rescan your wallet and try again.",
      );
    }
    return;
  }

  throw new Error("Invalid passport tier.");
}
