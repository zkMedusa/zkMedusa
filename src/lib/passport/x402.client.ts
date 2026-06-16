"use client";

import type { SignerWalletAdapterProps } from "@solana/wallet-adapter-base";
import { createX402Client } from "@dexterai/x402/client";
import type { SolanaWallet } from "@dexterai/x402/adapters";
import {
  getSolanaNetwork,
  getSolanaRpcUrl,
  getX402SolanaNetworkCaip2,
} from "./config";

type SignAllTransactions = SignerWalletAdapterProps["signAllTransactions"];

export interface PassportIssueConfig {
  skipPayment: boolean;
}

export async function fetchPassportIssueConfig(): Promise<PassportIssueConfig> {
  const response = await fetch("/api/passport/issue", { cache: "no-store" });

  if (!response.ok) {
    return { skipPayment: false };
  }

  const payload = (await response.json()) as PassportIssueConfig;
  return { skipPayment: payload.skipPayment === true };
}

function createDexterSolanaWallet(
  walletAddress: string,
  signAllTransactions: SignAllTransactions,
): SolanaWallet {
  if (!signAllTransactions) {
    throw new Error("Connected wallet does not support transaction signing.");
  }

  return {
    publicKey: {
      toBase58: () => walletAddress,
    },
    signTransaction: async <T>(tx: T): Promise<T> => {
      // Dexter provides a concrete transaction object type at runtime.
      // Wallet-adapter returns the same transaction type with signatures.
      const signed = await signAllTransactions([tx as never] as never);
      return signed[0] as T;
    },
  };
}

export function createPassportFetchWithPayment(
  walletAddress: string,
  signAllTransactions: SignAllTransactions,
) {
  const solanaWallet = createDexterSolanaWallet(
    walletAddress,
    signAllTransactions,
  );

  const network = getX402SolanaNetworkCaip2();
  const rpcUrl = getSolanaRpcUrl();
  // The adapter resolves an RPC by either the CAIP-2 id or the bare network
  // name, so register our endpoint under both. Without it the adapter falls
  // back to a default public RPC the browser can't reach ("Failed to fetch"
  // when reading the USDC mint account).
  const bareNetwork =
    getSolanaNetwork() === "mainnet-beta" ? "solana" : "solana-devnet";

  const client = createX402Client({
    wallets: { solana: solanaWallet },
    preferredNetwork: network,
    rpcUrls: {
      [network]: rpcUrl,
      [bareNetwork]: rpcUrl,
    },
  });

  // Keep the existing call pattern in `PassportFlow`.
  return (input: Parameters<typeof client.fetch>[0], init?: RequestInit) =>
    client.fetch(input, init);
}
