import { NextResponse } from "next/server";
import {
  getAuthorizedCampaignId,
  isPartnerAuthConfigured,
} from "@/lib/partner/auth.server";
import { listCampaignRegistrations } from "@/lib/partner/store.server";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaignId query parameter is required." },
        { status: 400 },
      );
    }

    if (campaignId !== authorizedCampaignId) {
      return NextResponse.json(
        { error: "API key is not authorized for this campaign." },
        { status: 403 },
      );
    }

    const entries = await listCampaignRegistrations(campaignId);

    return NextResponse.json({
      campaignId,
      count: entries.length,
      entries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch whitelist.",
      },
      { status: 500 },
    );
  }
}
