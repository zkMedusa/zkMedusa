import { PublicKey } from "@solana/web3.js";
import { TIER_LABELS } from "@/lib/passport/config";
import { isPublicClaimCampaign } from "@/lib/passport/claimCampaigns.server";
import { verifyPassportSignature } from "@/lib/passport/signing.server";
import type { MedusaPassport } from "@/lib/passport/types";

export function assertValidClaimWallet(claimWallet: string): void {
  try {
    new PublicKey(claimWallet);
  } catch {
    throw new Error("claimWallet is not a valid Solana address.");
  }
}

export function assertClaimPassport(passport: MedusaPassport): void {
  if (passport.type !== "medusa_passport_v1") {
    throw new Error("Unsupported passport type.");
  }

  if (new Date(passport.expiresAt).getTime() < Date.now()) {
    throw new Error("Passport has expired.");
  }

  if (!verifyPassportSignature(passport)) {
    throw new Error("Invalid passport signature.");
  }
}

export function assertClaimCampaign(campaignId: string): void {
  if (!campaignId.trim()) {
    throw new Error("campaignId is required.");
  }

  if (!isPublicClaimCampaign(campaignId)) {
    throw new Error("This campaign is not enabled for public claim registration.");
  }
}

export function buildRegistrationPayload(
  passport: MedusaPassport,
  claimWallet: string,
  campaignId: string,
) {
  return {
    campaignId,
    nullifier: passport.nullifier,
    claimWallet,
    tier: passport.statement.tier,
    tierLabel: TIER_LABELS[passport.statement.tier],
    registeredAt: new Date().toISOString(),
  };
}
