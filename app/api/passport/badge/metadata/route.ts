import { NextResponse } from "next/server";
import { PASSPORT_POLICY_VERSION, TIER_LABELS, type PassportTier } from "@/lib/passport/config";
import { buildBadgeMetadata } from "@/lib/passport/badge.shared";

export const dynamic = "force-dynamic";

function parseTier(raw: string | null): PassportTier {
  const value = Number(raw);
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  return 1;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tier = parseTier(searchParams.get("tier"));

  const metadata = buildBadgeMetadata({
    tier,
    tierLabel: TIER_LABELS[tier],
    policyVersion: searchParams.get("policy") ?? PASSPORT_POLICY_VERSION,
    expiresAt: searchParams.get("exp") ?? "",
    nullifier: searchParams.get("id") ?? "",
  });

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
