import { Connection, PublicKey } from "@solana/web3.js";
import {
  getSolanaRpcUrl,
  getVolumeWindowSeconds,
  PASSPORT_REQUIREMENTS,
} from "./config";
import type { WalletWitness } from "./types";

const SIGNATURE_PAGE_LIMIT = 1000;
const MAX_SIGNATURE_PAGES = 20;

function lamportsFromParsedTransaction(
  transaction: {
    meta: {
      preBalances: number[];
      postBalances: number[];
      fee: number;
    } | null;
  },
  walletIndex: number,
): number {
  if (!transaction.meta) {
    return 0;
  }

  const pre = transaction.meta.preBalances[walletIndex] ?? 0;
  const post = transaction.meta.postBalances[walletIndex] ?? 0;
  return Math.abs(post - pre);
}

export async function fetchWalletWitness(
  walletAddress: string,
): Promise<WalletWitness> {
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const publicKey = new PublicKey(walletAddress);
  const fetchedAt = Math.floor(Date.now() / 1000);
  const volumeCutoff = fetchedAt - getVolumeWindowSeconds();

  let before: string | undefined;
  let transactionCount = 0;
  let firstTxTimestamp = fetchedAt;
  let volumeLamports = 0;
  let pagesFetched = 0;

  while (pagesFetched < MAX_SIGNATURE_PAGES) {
    const signatures = await connection.getSignaturesForAddress(publicKey, {
      before,
      limit: SIGNATURE_PAGE_LIMIT,
    });

    if (signatures.length === 0) {
      break;
    }

    transactionCount += signatures.length;

    for (const signatureInfo of signatures) {
      if (!signatureInfo.blockTime) {
        continue;
      }

      firstTxTimestamp = Math.min(firstTxTimestamp, signatureInfo.blockTime);

      if (
        signatureInfo.blockTime >= volumeCutoff &&
        !signatureInfo.err
      ) {
        const parsed = await connection.getParsedTransaction(
          signatureInfo.signature,
          {
            maxSupportedTransactionVersion: 0,
          },
        );

        if (!parsed) {
          continue;
        }

        const walletIndex = parsed.transaction.message.accountKeys.findIndex(
          (account) => account.pubkey.equals(publicKey),
        );

        if (walletIndex >= 0) {
          volumeLamports += lamportsFromParsedTransaction(
            parsed as {
              meta: {
                preBalances: number[];
                postBalances: number[];
                fee: number;
              } | null;
            },
            walletIndex,
          );
        }
      }
    }

    before = signatures[signatures.length - 1]?.signature;
    pagesFetched += 1;

    if (signatures.length < SIGNATURE_PAGE_LIMIT) {
      break;
    }
  }

  if (transactionCount === 0) {
    throw new Error("No on-chain activity found for this wallet.");
  }

  return {
    firstTxTimestamp,
    transactionCount,
    volumeLamports,
    fetchedAt,
  };
}

export function formatVolumeInSol(volumeLamports: number): string {
  return (volumeLamports / 1_000_000_000).toFixed(2);
}

export function formatWalletAgeDays(
  witness: WalletWitness,
): string {
  const ageSeconds = witness.fetchedAt - witness.firstTxTimestamp;
  return (ageSeconds / 86400).toFixed(0);
}

export function getWitnessSummary(witness: WalletWitness): string {
  return `${formatWalletAgeDays(witness)} days old · ${witness.transactionCount} txs · ${formatVolumeInSol(witness.volumeLamports)} SOL volume (${PASSPORT_REQUIREMENTS.volumeWindowDays}d)`;
}
