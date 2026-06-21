import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { getSolanaNetwork } from "@/lib/passport/config";

export function decodeSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }
  return bs58.decode(trimmed);
}

export function loadKeypairFromSecret(secret: string): Keypair {
  return Keypair.fromSecretKey(decodeSecretKey(secret));
}

export function getBuybackAuthoritySecretKey(): string | undefined {
  return process.env.MEDUSA_BUYBACK_AUTHORITY_SECRET_KEY?.trim() || undefined;
}

export function getTreasurySecretKey(): string | undefined {
  return process.env.MEDUSA_TREASURY_SECRET_KEY?.trim() || undefined;
}

export function getBuybackAuthorityKeypair(): Keypair | null {
  const secret = getBuybackAuthoritySecretKey();
  if (!secret) {
    return null;
  }
  return loadKeypairFromSecret(secret);
}

export function getTreasuryKeypair(): Keypair | null {
  const secret = getTreasurySecretKey();
  if (!secret) {
    return null;
  }
  return loadKeypairFromSecret(secret);
}

export function getDevWalletAddress(fallback?: PublicKey): PublicKey {
  const configured = process.env.MEDUSA_DEV_WALLET?.trim();
  if (configured) {
    return new PublicKey(configured);
  }
  if (fallback) {
    return fallback;
  }
  throw new Error("MEDUSA_DEV_WALLET is not configured.");
}

export function getPassportTreasuryAddress(): PublicKey | null {
  const configured =
    process.env.PASSPORT_TREASURY_WALLET?.trim() ||
    process.env.NEXT_PUBLIC_PASSPORT_TREASURY_WALLET?.trim();
  if (!configured) {
    return null;
  }
  return new PublicKey(configured);
}

export function getOpsTreasuryAddress(): PublicKey | null {
  const configured = process.env.MEDUSA_OPS_TREASURY_WALLET?.trim();
  if (!configured) {
    return null;
  }
  return new PublicKey(configured);
}

export function getBuybackMinSol(): number {
  const value = Number(process.env.MEDUSA_BUYBACK_MIN_SOL ?? "0.05");
  return Number.isFinite(value) && value > 0 ? value : 0.05;
}

export function getBuybackMinUsdc(): number {
  const value = Number(process.env.MEDUSA_BUYBACK_MIN_USDC ?? "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getBuybackSlippageBps(): number {
  const value = Number(process.env.MEDUSA_BUYBACK_SLIPPAGE_BPS ?? "100");
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function getSolReserveLamports(): bigint {
  const minSol = getBuybackMinSol();
  return BigInt(Math.floor(minSol * 1_000_000_000));
}

export function getPumpClaimMinLamports(): bigint {
  const value = Number(process.env.MEDUSA_PUMP_CLAIM_MIN_SOL ?? "0.001");
  const minSol = Number.isFinite(value) && value > 0 ? value : 0.001;
  return BigInt(Math.floor(minSol * 1_000_000_000));
}

export function isBuybackConfigured(): boolean {
  return Boolean(getBuybackAuthoritySecretKey());
}

export function isBuybackEnabled(): boolean {
  const flag = process.env.MEDUSA_BUYBACK_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0") {
    return false;
  }
  return isBuybackConfigured();
}

export function isMainnetBuybackNetwork(): boolean {
  return getSolanaNetwork() === "mainnet-beta";
}
