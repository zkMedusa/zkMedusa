import { NextRequest, NextResponse } from "next/server";
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
  formatX402SetupError,
  getPassportIssueAmountAtomic,
  getX402IssueServer,
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

  return async (request: NextRequest) => {
    try {
      const paymentSignature = request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("payment-signature");
      const x402Server = getX402IssueServer();

      const treasuryIssue = await getTreasuryUsdcAccountIssue();
      if (treasuryIssue) {
        return NextResponse.json({ error: treasuryIssue }, { status: 503 });
      }

      // First request: no payment signature yet — respond with a 402 payment
      // challenge. Dexter's client SDK will pay and retry automatically.
      if (!paymentSignature) {
        const requirements = await x402Server.buildRequirements({
          amountAtomic: getPassportIssueAmountAtomic(),
          resourceUrl: request.url,
          description: "Mint Medusa Passport",
          mimeType: "application/json",
        });

        const response = x402Server.create402Response(requirements);
        const bodyJson = JSON.stringify(response.body ?? {});

        const res = new NextResponse(bodyJson, {
          status: response.status,
          headers: response.headers,
        });

        // Next sometimes lowercases/normalizes header values. Keep the
        // browser/client behavior deterministic.
        res.headers.set("Content-Type", "application/json");

        return res;
      }

      // Retry request after the client paid. Verify + settle then run the
      // actual issue handler.
      const verify = await x402Server.verifyPayment(paymentSignature);
      if (!verify.isValid) {
        return NextResponse.json(
          { error: verify.invalidReason ?? "Payment verification failed." },
          { status: 402 },
        );
      }

      const settle = await x402Server.settlePayment(paymentSignature);
      if (!settle.success) {
        return NextResponse.json(
          { error: settle.errorReason ?? "Payment settlement failed." },
          { status: 402 },
        );
      }

      return await handler(request);
    } catch (error) {
      return NextResponse.json(
        { error: formatX402SetupError(error) },
        { status: 502 },
      );
    }
  };
}

export const POST = wrapIssueRouteWithPayment(issuePassport);
