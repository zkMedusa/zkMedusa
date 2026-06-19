import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import { issueNonce } from "@/lib/partner/nonce.server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const partner = getPartnerById(id);

  if (!partner) {
    return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
  }

  const nonce = await issueNonce();
  const issuedAt = new Date().toISOString();

  return NextResponse.json({ nonce, issuedAt, partnerName: partner.name });
}
