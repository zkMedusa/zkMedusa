import { NextResponse } from "next/server";
import {
  assertClaimPassport,
  assertValidClaimWallet,
} from "@/lib/passport/claim.server";
import { getBadgeCollectionAddress } from "@/lib/passport/config";
import {
  getBadgeForNullifier,
  isBadgeMintingConfigured,
  mintSoulboundBadge,
} from "@/lib/passport/badge.server";
import type { MedusaPassport } from "@/lib/passport/types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface BadgeMintRequest {
  passport: MedusaPassport;
  claimWallet: string;
  campaignId?: string;
}

export async function GET() {
  return NextResponse.json({
    configured: isBadgeMintingConfigured(),
    collection: getBadgeCollectionAddress(),
  });
}

export async function POST(request: Request) {
  try {
    if (!isBadgeMintingConfigured()) {
      return NextResponse.json(
        {
          error:
            "Soulbound badge minting is not configured on this deployment.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as BadgeMintRequest;

    if (!body.passport || !body.claimWallet) {
      return NextResponse.json(
        { error: "passport and claimWallet are required." },
        { status: 400 },
      );
    }

    assertValidClaimWallet(body.claimWallet);
    assertClaimPassport(body.passport);

    const existing = getBadgeForNullifier(body.passport.nullifier);
    if (existing) {
      return NextResponse.json({ minted: true, alreadyMinted: true, badge: existing });
    }

    const badge = await mintSoulboundBadge({
      passport: body.passport,
      claimWallet: body.claimWallet,
      campaignId: body.campaignId,
    });

    return NextResponse.json({ minted: true, alreadyMinted: false, badge });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to mint soulbound badge.",
      },
      { status: 500 },
    );
  }
}
