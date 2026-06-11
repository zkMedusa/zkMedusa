import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RouteConfig } from "@x402/core/server";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import {
  getSolanaNetwork,
  getX402FacilitatorUrl,
  getX402SolanaNetworkCaip2,
  getPassportIssuePriceLabel,
} from "./config";

let resourceServer: x402ResourceServer | null = null;

export function isPassportPaymentSkipped(): boolean {
  return process.env.PASSPORT_DEV_SKIP_PAYMENT === "true";
}

export function getX402ResourceServer(): x402ResourceServer {
  if (resourceServer) {
    return resourceServer;
  }

  const treasury = process.env.PASSPORT_TREASURY_WALLET;
  if (!treasury) {
    throw new Error("PASSPORT_TREASURY_WALLET is not configured.");
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: getX402FacilitatorUrl(),
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
