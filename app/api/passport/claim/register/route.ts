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
  hasCampaignRegistration,
  saveCampaignRegistration,
} from "@/lib/partner/store.server";

interface ClaimRegisterRequest {
  passport: MedusaPassport;
  claimWallet: string;
  campaignId?: string;
}

export async function GET() {
  return NextResponse.json({
    defaultCampaignId: getDefaultClaimCampaignId(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClaimRegisterRequest;

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

    if (hasCampaignRegistration(campaignId, body.passport.nullifier)) {
      return NextResponse.json(
        {
          error:
            "This passport already has a claim wallet for this campaign. Rotate instead.",
        },
        { status: 409 },
      );
    }

    const registration = saveCampaignRegistration(
      buildRegistrationPayload(body.passport, body.claimWallet, campaignId),
    );

    return NextResponse.json({
      registered: true,
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
            : "Unable to register claim wallet.",
      },
      { status: 400 },
    );
  }
}
