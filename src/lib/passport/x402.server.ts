import { createCdpAuthHeaders } from "@coinbase/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RouteConfig } from "@x402/core/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import {
  assertX402FacilitatorConfigured,
  getCdpApiCredentials,
  getPassportIssuePriceLabel,
  getSolanaNetwork,
  getX402FacilitatorUrl,
  getX402SolanaNetworkCaip2,
  isCdpFacilitatorUrl,
} from "./config";

let resourceServer: x402ResourceServer | null = null;

export function isPassportPaymentSkipped(): boolean {
  return process.env.PASSPORT_DEV_SKIP_PAYMENT === "true";
}

export function getX402ResourceServer(): x402ResourceServer {
  if (resourceServer) {
    return resourceServer;
  }

  assertX402FacilitatorConfigured();

  const treasury = process.env.PASSPORT_TREASURY_WALLET;
  if (!treasury) {
    throw new Error("PASSPORT_TREASURY_WALLET is not configured.");
  }

  const facilitatorUrl = getX402FacilitatorUrl();
  const cdpCredentials = getCdpApiCredentials();
  const facilitatorClient = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    ...(isCdpFacilitatorUrl(facilitatorUrl) && cdpCredentials
      ? {
          createAuthHeaders: createCdpAuthHeaders(
            cdpCredentials.id,
            cdpCredentials.secret,
          ),
        }
      : {}),
  });

  resourceServer = new x402ResourceServer(facilitatorClient);
  registerExactSvmScheme(resourceServer);

  return resourceServer;
}

export function getPassportIssueRouteConfig(): RouteConfig {
  const treasury = process.env.PASSPORT_TREASURY_WALLET;
  if (!treasury) {
    throw new Error("PASSPORT_TREASURY_WALLET is not configured.");
  }

  return {
    accepts: {
      scheme: "exact",
      price: getPassportIssuePriceLabel(),
      network: getX402SolanaNetworkCaip2(),
      payTo: treasury,
    },
    description: "Mint Medusa Passport",
    mimeType: "application/json",
  };
}

export function getX402PaywallConfig() {
  return {
    appName: "Medusa Passport",
    testnet: getSolanaNetwork() !== "mainnet-beta",
  };
}

export function formatX402SetupError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Facilitator getSupported failed (401)")) {
    return "x402 facilitator rejected the request (401). On devnet use https://x402.org/facilitator with no CDP keys. On mainnet set CDP_API_KEY_ID and CDP_API_KEY_SECRET.";
  }

  if (message.includes("Facilitator")) {
    return `x402 payment setup failed: ${message}`;
  }

  if (message.includes("PASSPORT_TREASURY_WALLET")) {
    return "Passport treasury wallet is not configured on the server.";
  }

  if (message.includes("CDP_API_KEY")) {
    return message;
  }

  return message;
}
