import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { TIER_LABELS } from "@/lib/passport/config";
import { verifyPassportSignature } from "@/lib/passport/signing.server";
import type { MedusaPassport } from "@/lib/passport/types";
import {
  getAuthorizedCampaignId,
  isPartnerAuthConfigured,
} from "@/lib/partner/auth.server";
import {
  hasCampaignRegistration,
  saveCampaignRegistration,
} from "@/lib/partner/store.server";

interface RegisterRequest {
  passport: MedusaPassport;
  claimWallet: string;
  campaignId: string;
}

function isExpired(passport: MedusaPassport): boolean {
  return new Date(passport.expiresAt).getTime() < Date.now();
}

export async function POST(request: Request) {
  try {
    if (!isPartnerAuthConfigured()) {
      return NextResponse.json(
        { error: "Partner API keys are not configured on this server." },
        { status: 503 },
      );
    }

    const authorizedCampaignId = getAuthorizedCampaignId(
      request.headers.get("authorization"),
    );

    if (!authorizedCampaignId) {
      return NextResponse.json({ error: "Unauthorized partner API key." }, { status: 401 });
    }

    const body = (await request.json()) as RegisterRequest;

    if (!body.passport || !body.claimWallet || !body.campaignId) {
      return NextResponse.json(
        { error: "passport, claimWallet, and campaignId are required." },
        { status: 400 },
      );
    }

    if (body.campaignId !== authorizedCampaignId) {
      return NextResponse.json(
        { error: "API key is not authorized for this campaign." },
        { status: 403 },
      );
    }

    try {
      new PublicKey(body.claimWallet);
    } catch {
      return NextResponse.json(
        { error: "claimWallet is not a valid Solana address." },
        { status: 400 },
      );
    }

    if (body.passport.type !== "medusa_passport_v1") {
      return NextResponse.json(
        { error: "Unsupported passport type." },
        { status: 400 },
      );
    }

    if (isExpired(body.passport)) {
      return NextResponse.json(
        { error: "Passport has expired." },
        { status: 400 },
      );
    }

    if (!verifyPassportSignature(body.passport)) {
      return NextResponse.json(
        { error: "Invalid passport signature." },
        { status: 400 },
      );
    }

    if (hasCampaignRegistration(body.campaignId, body.passport.nullifier)) {
      return NextResponse.json(
        { error: "This passport has already been registered for this campaign." },
        { status: 409 },
      );
    }

    const registeredAt = new Date().toISOString();
    const registration = saveCampaignRegistration({
      campaignId: body.campaignId,
      nullifier: body.passport.nullifier,
      claimWallet: body.claimWallet,
      tier: body.passport.statement.tier,
      tierLabel: TIER_LABELS[body.passport.statement.tier],
      registeredAt,
    });

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
          error instanceof Error ? error.message : "Unable to register passport.",
      },
      { status: 500 },
    );
  }
}
