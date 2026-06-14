import { NextResponse } from "next/server";
import {
  assertClaimCampaign,
  assertClaimPassport,
  assertValidClaimWallet,
  buildRegistrationPayload,
} from "@/lib/passport/claim.server";
import { getDefaultClaimCampaignId } from "@/lib/passport/claimCampaigns.server";
import type { MedusaPassport } from "@/lib/passport/types";
import {
  getCampaignRegistration,
  rotateCampaignRegistration,
} from "@/lib/partner/store.server";

interface ClaimRotateRequest {
  passport: MedusaPassport;
  claimWallet: string;
  campaignId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClaimRotateRequest;

    if (!body.passport || !body.claimWallet) {
      return NextResponse.json(
        { error: "passport and claimWallet are required." },
        { status: 400 },
      );
    }

    const campaignId = body.campaignId?.trim() || getDefaultClaimCampaignId();

    assertValidClaimWallet(body.claimWallet);
    assertClaimPassport(body.passport);
    assertClaimCampaign(campaignId);

    const existing = getCampaignRegistration(
      campaignId,
      body.passport.nullifier,
    );

    if (!existing) {
      return NextResponse.json(
        { error: "No claim wallet registered for this passport and campaign." },
        { status: 404 },
      );
    }

    if (existing.claimWallet === body.claimWallet) {
      return NextResponse.json(
        { error: "This claim wallet is already registered for the campaign." },
        { status: 409 },
      );
    }

    const registration = rotateCampaignRegistration(
      buildRegistrationPayload(body.passport, body.claimWallet, campaignId),
    );

    return NextResponse.json({
      rotated: true,
      previousClaimWallet: existing.claimWallet,
      campaignId: registration.campaignId,
      claimWallet: registration.claimWallet,
      tier: registration.tier,
      tierLabel: registration.tierLabel,
      nullifier: registration.nullifier,
      registeredAt: registration.registeredAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to rotate claim wallet.",
      },
      { status: 400 },
    );
  }
}
