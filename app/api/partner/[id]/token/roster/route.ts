import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import {
  getAuthorizedPartnerId,
  isPartnerAuthConfigured,
} from "@/lib/partner/auth.server";
import { listPartnerTokenRoster } from "@/lib/partner/tokenStore.server";

/**
 * Partner export: Telegram usernames + effective eligibility only.
 * No wallet addresses, balances, or holder ids are exposed.
 *
 * Auth: `Authorization: Bearer <apiKey>` where the key is scoped to this
 * partner id in MEDUSA_PARTNER_API_KEYS (e.g. deepbot:sk_live_...).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!isPartnerAuthConfigured()) {
      return NextResponse.json(
        { error: "Partner API keys are not configured on this server." },
        { status: 503 },
      );
    }

    const { id } = await params;
    const partner = getPartnerById(id);
    if (!partner) {
      return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
    }

    const authorizedPartnerId = getAuthorizedPartnerId(
      request.headers.get("authorization"),
    );

    if (!authorizedPartnerId) {
      return NextResponse.json(
        { error: "Unauthorized partner API key." },
        { status: 401 },
      );
    }

    if (authorizedPartnerId !== partner.id) {
      return NextResponse.json(
        { error: "API key is not authorized for this partner." },
        { status: 403 },
      );
    }

    const entries = await listPartnerTokenRoster(partner.id);

    return NextResponse.json({
      partnerId: partner.id,
      count: entries.length,
      entries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch roster.",
      },
      { status: 500 },
    );
  }
}
