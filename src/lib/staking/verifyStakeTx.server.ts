import { Connection, PublicKey } from "@solana/web3.js";
import { medusaAmountToRaw, rawToMedusaAmount } from "@/lib/staking/amounts";
import { getMedusaMintAddress } from "@/lib/staking/config";
import { getStreamflowTier } from "@/lib/staking/streamflowPools";

export interface VerifiedStakeTx {
  signature: string;
  wallet: string;
  tierDays: number;
  amount: string;
  stakePool: string;
}

type FetchedTransaction = NonNullable<
  Awaited<ReturnType<Connection["getTransaction"]>>
>;

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseWalletAddress(wallet: string): PublicKey {
  try {
    return new PublicKey(wallet.trim());
  } catch {
    throw new Error("Invalid wallet address.");
  }
}

function getTransactionAccountKeys(tx: FetchedTransaction): string[] {
  const message = tx.transaction.message;

  if ("accountKeys" in message && Array.isArray(message.accountKeys)) {
    return message.accountKeys.map((key) =>
      typeof key === "string" ? key : key.toBase58(),
    );
  }

  const accountKeys = message.getAccountKeys({
    accountKeysFromLookups: tx.meta?.loadedAddresses ?? undefined,
  });
  const keys: string[] = [];
  for (let index = 0; index < accountKeys.length; index += 1) {
    keys.push(accountKeys.get(index)!.toBase58());
  }
  return keys;
}

function getTransactionSigners(tx: FetchedTransaction): string[] {
  const accountKeys = getTransactionAccountKeys(tx);
  const { numRequiredSignatures } = tx.transaction.message.header;
  return accountKeys.slice(0, numRequiredSignatures);
}

async function fetchConfirmedStakeTransaction(
  connection: Connection,
  signature: string,
): Promise<FetchedTransaction> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (tx?.meta?.err) {
      throw new Error("Stake transaction failed on-chain.");
    }

    if (tx) {
      return tx;
    }

    await sleep(1000 * (attempt + 1));
  }

  throw new Error("Stake transaction not found yet. Try again shortly.");
}

function readStakedAmountFromMeta(
  tx: FetchedTransaction,
  wallet: string,
  mint: string,
): string | null {
  const meta = tx.meta;
  if (!meta?.preTokenBalances?.length || !meta.postTokenBalances?.length) {
    return null;
  }

  const preByIndex = new Map(
    meta.preTokenBalances
      .filter((entry) => entry.mint === mint && entry.owner === wallet)
      .map((entry) => [entry.accountIndex, BigInt(entry.uiTokenAmount.amount)]),
  );

  let delta = BigInt(0);
  for (const post of meta.postTokenBalances) {
    if (post.mint !== mint || post.owner !== wallet) {
      continue;
    }
    const before = preByIndex.get(post.accountIndex) ?? BigInt(0);
    const after = BigInt(post.uiTokenAmount.amount);
    if (after < before) {
      delta += before - after;
    }
  }

  if (delta <= BigInt(0)) {
    return null;
  }

  return rawToMedusaAmount(delta);
}

export async function verifyStakeTransaction(
  connection: Connection,
  params: {
    signature: string;
    wallet: string;
    tierDays: number;
    amount: string;
  },
): Promise<VerifiedStakeTx> {
  const signature = params.signature.trim();
  const wallet = parseWalletAddress(params.wallet).toBase58();

  if (!SIGNATURE_RE.test(signature)) {
    throw new Error("Invalid transaction signature.");
  }

  const tier = getStreamflowTier(params.tierDays);
  if (!tier) {
    throw new Error("Unknown staking tier.");
  }

  medusaAmountToRaw(params.amount);

  const tx = await fetchConfirmedStakeTransaction(connection, signature);
  const accountKeys = getTransactionAccountKeys(tx);
  const signers = getTransactionSigners(tx);
  const mint = getMedusaMintAddress();

  if (!signers.includes(wallet)) {
    throw new Error("Wallet did not sign this transaction.");
  }

  if (!accountKeys.includes(tier.stakePool)) {
    throw new Error("Transaction does not target the expected stake pool.");
  }

  if (!accountKeys.includes(mint)) {
    throw new Error("Transaction does not involve the MEDUSA mint.");
  }

  const parsedAmount = readStakedAmountFromMeta(tx, wallet, mint);
  const amount = parsedAmount ?? params.amount.trim();

  return {
    signature,
    wallet,
    tierDays: params.tierDays,
    amount,
    stakePool: tier.stakePool,
  };
}
