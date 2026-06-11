import { Connection, PublicKey } from "@solana/web3.js";
import { getSolanaNetwork, getSolanaRpcUrl } from "./config";
import {
  getAssociatedTokenAddress,
  getUsdcMintAddress,
} from "./usdc.shared";

let treasuryCheckPromise: Promise<string | null> | null = null;

export async function getTreasuryUsdcAccountIssue(): Promise<string | null> {
  if (treasuryCheckPromise) {
    return treasuryCheckPromise;
  }

  treasuryCheckPromise = (async () => {
    const treasury = process.env.PASSPORT_TREASURY_WALLET?.trim();
    if (!treasury) {
      return "PASSPORT_TREASURY_WALLET is not configured.";
    }

    let treasuryKey: PublicKey;
    try {
      treasuryKey = new PublicKey(treasury);
    } catch {
      return "PASSPORT_TREASURY_WALLET is not a valid Solana address.";
    }

    const network = getSolanaNetwork();
    const mint = getUsdcMintAddress(network);
    const ata = getAssociatedTokenAddress(treasuryKey, mint);
    const connection = new Connection(getSolanaRpcUrl(), "confirmed");
    const account = await connection.getAccountInfo(ata);

    if (account) {
      return null;
    }

    return `Treasury wallet has no USDC token account on ${network}. Send a small amount of USDC to ${treasury} (or create its USDC ATA) before accepting passport payments. Expected ATA: ${ata.toBase58()}.`;
  })();

  return treasuryCheckPromise;
}
