import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import {
  getPublicInputs,
  PASSPORT_POLICY_VERSION,
  PASSPORT_VALIDITY_DAYS,
  TIER_LABELS,
} from "@/lib/passport/config";
import { signPassportPayload } from "@/lib/passport/signing.server";
import {
  hasNullifierBeenUsed,
  registerNullifier,
} from "@/lib/passport/store.server";
import type { IssuePassportRequest, MedusaPassport } from "@/lib/passport/types";
import { parseIssuePassportRequest } from "@/lib/passport/request.server";
import { verifySubmittedProof } from "@/lib/passport/verify.server";
import {
  getPassportIssueRouteConfig,
  getX402PaywallConfig,
  getX402ResourceServer,
  formatX402SetupError,
  isPassportPaymentSkipped,
} from "@/lib/passport/x402.server";
import { getTreasuryUsdcAccountIssue } from "@/lib/passport/usdc.server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function issuePassport(request: NextRequest) {
  try {
    const body = await parseIssuePassportRequest(request);

    if (hasNullifierBeenUsed(body.nullifier)) {
      return NextResponse.json(
        { error: "This passport nullifier has already been issued." },
        { status: 409 },
      );
    }

    const proofResult = await verifySubmittedProof(body.zkProof, body.tier);
    if (!proofResult.valid) {
      return NextResponse.json(
        {
          error: proofResult.error,
        },
        { status: 400 },
      );
    }

    const issuedAt = new Date();
    const expiresAt = new Date(
      issuedAt.getTime() + PASSPORT_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
    );

    const unsignedPassport: Omit<MedusaPassport, "signature"> = {
      type: "medusa_passport_v1",
      chain: "solana",
      statement: {
        policyVersion: PASSPORT_POLICY_VERSION,
        tier: body.tier,
        tierLabel: TIER_LABELS[body.tier],
        minWalletAgeDays: body.publicInputs.min_age_seconds / 86400,
        minTransactionCount: body.publicInputs.min_tx_count,
        publicInputs: body.publicInputs,
      },
      nullifier: body.nullifier,
      zkProof: body.zkProof,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      issuer: "medusa",
    };

    const passport: MedusaPassport = {
      ...unsignedPassport,
      signature: signPassportPayload(unsignedPassport),
    };

    registerNullifier(body.nullifier);

    return NextResponse.json({ passport });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to issue passport.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    publicInputs: getPublicInputs(Math.floor(Date.now() / 1000)),
    skipPayment: isPassportPaymentSkipped(),
  });
}

function wrapIssueRouteWithPayment(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  if (isPassportPaymentSkipped()) {
    return handler;
  }

  const protectedHandler = withX402(
    handler,
    getPassportIssueRouteConfig(),
    getX402ResourceServer(),
    getX402PaywallConfig(),
  );

  return async (request: NextRequest) => {
    try {
      const treasuryIssue = await getTreasuryUsdcAccountIssue();
      if (treasuryIssue) {
        return NextResponse.json({ error: treasuryIssue }, { status: 503 });
      }

      return await protectedHandler(request);
    } catch (error) {
      return NextResponse.json(
        { error: formatX402SetupError(error) },
        { status: 502 },
      );
    }
  };
}

export const POST = wrapIssueRouteWithPayment(issuePassport);
