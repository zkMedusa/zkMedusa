import { PublicKey } from "@solana/web3.js";

export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

export function getUsdcMintAddress(
  network: "devnet" | "mainnet-beta",
): PublicKey {
  return network === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

export function getAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  return address;
}

/** $0.50 USDC with 6 decimals */
export const PASSPORT_ISSUE_PRICE_USDC_MICRO = 500_000;

export function formatUsdcMicroAmount(microAmount: number): string {
  return (microAmount / 1_000_000).toFixed(2);
}
