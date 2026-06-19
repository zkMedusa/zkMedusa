import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import { getTokenHolderStats } from "@/lib/partner/tokenStore.server";

/** Anonymous aggregate counts for a partner. No addresses are exposed. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const partner = getPartnerById(id);
  if (!partner) {
    return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
  }

  const stats = await getTokenHolderStats(partner.id);
  return NextResponse.json({ partnerId: partner.id, ...stats });
}
