"use client";

import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, type Connection } from "@solana/web3.js";
import { getMedusaMintAddress } from "@/lib/staking/config";

export async function fetchMedusaWalletBalance(
  connection: Connection,
  wallet: PublicKey,
): Promise<number> {
  const mint = new PublicKey(getMedusaMintAddress());
  const ata = getAssociatedTokenAddressSync(
    mint,
    wallet,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  try {
    const balance = await connection.getTokenAccountBalance(ata);
    const amount = Number(balance.value.uiAmountString ?? balance.value.amount);
    return Number.isFinite(amount) ? amount : 0;
  } catch {
    return 0;
  }
}

/** Format a wallet balance for the stake amount input. */
export function formatStakeInputAmount(
  amount: number,
  maxDecimals = 6,
): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "0";
  }

  const fixed = amount.toFixed(maxDecimals);
  return fixed.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

export function stakeAmountFromBalancePercent(
  balance: number,
  percent: number,
): string {
  if (!Number.isFinite(balance) || balance <= 0) {
    return "0";
  }

  const fraction = percent >= 100 ? 1 : percent / 100;
  return formatStakeInputAmount(balance * fraction);
}
