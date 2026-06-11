"use client";

import type { Connection, PublicKey } from "@solana/web3.js";
import { getSolanaNetwork } from "./config";
import {
  formatUsdcMicroAmount,
  getAssociatedTokenAddress,
  getUsdcMintAddress,
  PASSPORT_ISSUE_PRICE_USDC_MICRO,
} from "./usdc.shared";

export type UsdcPaymentReadiness =
  | { ready: true }
  | { ready: false; message: string };

export async function checkUsdcPaymentReadiness(
  connection: Connection,
  wallet: PublicKey,
  requiredMicro = PASSPORT_ISSUE_PRICE_USDC_MICRO,
): Promise<UsdcPaymentReadiness> {
  const network = getSolanaNetwork();
  const mint = getUsdcMintAddress(network);
  const ata = getAssociatedTokenAddress(wallet, mint);
  const account = await connection.getAccountInfo(ata);

  if (!account) {
    return {
      ready: false,
      message: `Your wallet has no USDC account on Solana ${network}. Swap or receive at least $${formatUsdcMicroAmount(requiredMicro)} USDC on ${network} before paying.`,
    };
  }

  try {
    const balance = await connection.getTokenAccountBalance(ata);
    const amountMicro = Number(balance.value.amount);

    if (!Number.isFinite(amountMicro) || amountMicro < requiredMicro) {
      const have = formatUsdcMicroAmount(Number.isFinite(amountMicro) ? amountMicro : 0);
      const need = formatUsdcMicroAmount(requiredMicro);
      return {
        ready: false,
        message: `Insufficient USDC balance. You have $${have} USDC but need $${need} on Solana ${network}.`,
      };
    }
  } catch {
    return {
      ready: false,
      message: `Unable to read your USDC balance on Solana ${network}. Confirm your wallet is on ${network} and try again.`,
    };
  }

  return { ready: true };
}

export function formatPaymentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Transaction failed simulation")) {
    return "Wallet simulation failed. You need at least $0.50 USDC on Solana mainnet in your wallet, and the treasury must have a USDC token account. Do not approve if Phantom shows a simulation error.";
  }

  if (message.includes("Failed to create payment payload")) {
    if (message.includes("feePayer")) {
      return "x402 payment setup failed (missing fee payer from facilitator). Check server facilitator configuration.";
    }
    return message;
  }

  if (message.includes("User rejected") || message.includes("rejected the request")) {
    return "Payment was cancelled in your wallet.";
  }

  if (message.includes("Insufficient USDC") || message.includes("no USDC account")) {
    return message;
  }

  if (message.includes("Treasury wallet has no USDC token account")) {
    return message;
  }

  if (message.includes("Facilitator") || message.includes("x402")) {
    return message;
  }

  return message || "Passport issuance failed.";
}
