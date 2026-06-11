import { NextResponse } from "next/server";
import { PASSPORT_POLICY_VERSION } from "@/lib/passport/config";
import { getIssuerPublicKeyHex } from "@/lib/passport/signing.server";

export async function GET() {
  return NextResponse.json({
    issuer: "medusa",
    publicKey: getIssuerPublicKeyHex(),
    policyVersion: PASSPORT_POLICY_VERSION,
  });
}
