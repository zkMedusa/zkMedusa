import { sha256 } from "@noble/hashes/sha2.js";
import {
  PASSPORT_REQUIREMENTS,
  PASSPORT_TIERS,
  TIER_LABELS,
  type PassportTier,
} from "./config";
import type { EligibilityResult, WalletWitness } from "./types";

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

export function randomFieldSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return BigInt(`0x${bytesToHex(bytes)}`).toString();
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
