import { NextResponse } from "next/server";
import {
  getPassportIssuePriceLabel,
  getPublicInputs,
  PASSPORT_POLICY_VERSION,
  PASSPORT_REQUIREMENTS,
  PASSPORT_VALIDITY_DAYS,
  TIER_LABELS,
} from "@/lib/passport/config";
import { verifyPassportSignature } from "@/lib/passport/signing.server";
import type { MedusaPassport } from "@/lib/passport/types";

export async function POST(request: Request) {
  try {
    const passport = (await request.json()) as MedusaPassport;

    if (passport.type !== "medusa_passport_v1") {
      return NextResponse.json(
        { valid: false, error: "Unsupported passport type." },
        { status: 400 },
      );
    }

    if (passport.statement.policyVersion !== PASSPORT_POLICY_VERSION) {
      return NextResponse.json(
        { valid: false, error: "Passport policy version mismatch." },
        { status: 400 },
      );
    }

    if (new Date(passport.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { valid: false, error: "Passport has expired." },
        { status: 400 },
      );
    }

    const signatureValid = verifyPassportSignature(passport);
    if (!signatureValid) {
      return NextResponse.json(
        { valid: false, error: "Invalid passport signature." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      valid: true,
      passport,
      tierLabel: TIER_LABELS[passport.statement.tier],
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error:
          error instanceof Error ? error.message : "Unable to verify passport.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    policyVersion: PASSPORT_POLICY_VERSION,
    requirements: PASSPORT_REQUIREMENTS,
    validityDays: PASSPORT_VALIDITY_DAYS,
    issuePrice: getPassportIssuePriceLabel(),
    publicInputTemplate: getPublicInputs(Math.floor(Date.now() / 1000)),
    devMode: process.env.PASSPORT_DEV_SKIP_ZK === "true",
  });
}
