"use client";

import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import type { ClientSvmSigner } from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import type { SignerWalletAdapterProps } from "@solana/wallet-adapter-base";
import { getSolanaRpcUrl } from "./config";
import { createWalletAdapterSigner } from "./walletAdapterSigner.client";

type SignAllTransactions = SignerWalletAdapterProps["signAllTransactions"];

export function createPassportFetchWithPayment(
  walletAddress: string,
  signAllTransactions: SignAllTransactions,
) {
  const signer = createWalletAdapterSigner(
    walletAddress,
    signAllTransactions,
  ) as unknown as ClientSvmSigner;
  const client = new x402Client();
  client.register(
    "solana:*",
    new ExactSvmScheme(signer, { rpcUrl: getSolanaRpcUrl() }),
  );

  return wrapFetchWithPayment(fetch, client);
}
