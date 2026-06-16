import { createX402Server } from "@dexterai/x402/server";
import { toAtomicUnits } from "@dexterai/x402/utils";
import {
  PASSPORT_ISSUE_PRICE_USDC,
  getX402SolanaNetworkCaip2,
} from "./config";

let issueX402Server: ReturnType<typeof createX402Server> | null = null;

export function isPassportPaymentSkipped(): boolean {
  return process.env.PASSPORT_DEV_SKIP_PAYMENT === "true";
}

function getConfiguredIssuePriceUsd(): string {
  return (
    process.env.NEXT_PUBLIC_PASSPORT_ISSUE_PRICE_USDC ??
    process.env.PASSPORT_ISSUE_PRICE_USDC ??
    PASSPORT_ISSUE_PRICE_USDC
  );
}

export function getPassportIssueAmountAtomic(): string {
  // x402 accepts amount in atomic units for the payment asset (USDC = 6 decimals).
  const usd = getConfiguredIssuePriceUsd();
  return toAtomicUnits(Number(usd), 6);
}

export function getX402IssueServer(): ReturnType<typeof createX402Server> {
  if (issueX402Server) {
    return issueX402Server;
  }

  const treasury = process.env.PASSPORT_TREASURY_WALLET;
  if (!treasury) {
    throw new Error("PASSPORT_TREASURY_WALLET is not configured.");
  }

  // Dexter's client-side SDK expects a v2 flow and returns 402 challenges.
  // If you override the facilitator URL, ensure it is compatible with x402 v2.
  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL?.trim() || "https://x402.dexter.cash";

  issueX402Server = createX402Server({
    payTo: treasury,
    network: getX402SolanaNetworkCaip2(),
    facilitatorUrl,
    // "exact" is the default, but keep it explicit for clarity.
    scheme: "exact",
  });

  return issueX402Server;
}

export function formatX402SetupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("PASSPORT_TREASURY_WALLET")) {
    return "Passport treasury wallet is not configured on the server.";
  }

  return `x402 payment setup failed: ${message}`;
}
