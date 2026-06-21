import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  hasCoinCreatorMigratedToSharingConfig,
  OnlinePumpSdk,
} from "@pump-fun/pump-sdk";
import { getPumpClaimMinLamports } from "@/lib/staking/buyback.config.server";

const PUMP_BLOCK_API = "https://fun-block.pump.fun";
const PUMP_CLAIM_COMPUTE_UNITS = 200_000;

export interface PumpClaimResult {
  claimableLamports: bigint;
  claimedLamports: bigint;
  usesSharingConfig: boolean;
  signature?: string;
  skipped?: string;
  error?: string;
}

async function confirmSignatureHttp(
  connection: Connection,
  signature: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) {
      throw new Error(`Pump claim failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out confirming pump claim ${signature}.`);
}

async function getPumpClaimableLamports(
  onlineSdk: OnlinePumpSdk,
  mint: PublicKey,
  authority: PublicKey,
): Promise<{ claimableLamports: bigint; usesSharingConfig: boolean }> {
  const bondingCurve = await onlineSdk.fetchBondingCurve(mint);
  const usesSharingConfig = hasCoinCreatorMigratedToSharingConfig({
    mint,
    creator: bondingCurve.creator,
  });

  if (usesSharingConfig) {
    const feeInfo = await onlineSdk.getMinimumDistributableFee(
      mint,
      authority,
    );
    if (!feeInfo.canDistribute) {
      return { claimableLamports: BigInt(0), usesSharingConfig };
    }
    return {
      claimableLamports: BigInt(feeInfo.distributableFees.toString()),
      usesSharingConfig,
    };
  }

  const balance = await onlineSdk.getCreatorVaultBalanceBothPrograms(
    bondingCurve.creator,
  );
  return {
    claimableLamports: BigInt(balance.toString()),
    usesSharingConfig,
  };
}

async function buildClaimTxViaApi(
  mint: PublicKey,
  user: PublicKey,
): Promise<VersionedTransaction | null> {
  try {
    const response = await fetch(`${PUMP_BLOCK_API}/agents/collect-fees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mint: mint.toBase58(),
        user: user.toBase58(),
        encoding: "base64",
        frontRunningProtection: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { transaction?: string };
    if (!payload.transaction) {
      return null;
    }

    return VersionedTransaction.deserialize(
      Buffer.from(payload.transaction, "base64"),
    );
  } catch {
    return null;
  }
}

async function buildClaimTxViaSdk(
  connection: Connection,
  onlineSdk: OnlinePumpSdk,
  authority: Keypair,
  mint: PublicKey,
  usesSharingConfig: boolean,
): Promise<VersionedTransaction> {
  const instructions = usesSharingConfig
    ? (await onlineSdk.buildDistributeCreatorFeesInstructions(mint)).instructions
    : await onlineSdk.collectCoinCreatorFeeInstructions(
        (await onlineSdk.fetchBondingCurve(mint)).creator,
        authority.publicKey,
      );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: PUMP_CLAIM_COMPUTE_UNITS,
      }),
      ...instructions,
    ],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);
  transaction.sign([authority]);
  return transaction;
}

async function sendPumpClaimTransaction({
  connection,
  onlineSdk,
  authority,
  mint,
  usesSharingConfig,
}: {
  connection: Connection;
  onlineSdk: OnlinePumpSdk;
  authority: Keypair;
  mint: PublicKey;
  usesSharingConfig: boolean;
}): Promise<string> {
  const apiTransaction = await buildClaimTxViaApi(mint, authority.publicKey);
  const transaction =
    apiTransaction ??
    (await buildClaimTxViaSdk(
      connection,
      onlineSdk,
      authority,
      mint,
      usesSharingConfig,
    ));

  if (apiTransaction) {
    transaction.sign([authority]);
  }

  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    },
  );
  await confirmSignatureHttp(connection, signature);
  return signature;
}

export async function claimPumpCreatorFees({
  connection,
  authority,
  mint,
  dryRun,
}: {
  connection: Connection;
  authority: Keypair;
  mint: PublicKey;
  dryRun: boolean;
}): Promise<PumpClaimResult> {
  const minClaim = getPumpClaimMinLamports();
  const onlineSdk = new OnlinePumpSdk(connection);

  try {
    const { claimableLamports, usesSharingConfig } =
      await getPumpClaimableLamports(onlineSdk, mint, authority.publicKey);

    if (claimableLamports < minClaim) {
      return {
        claimableLamports,
        claimedLamports: BigInt(0),
        usesSharingConfig,
        skipped:
          claimableLamports > BigInt(0)
            ? `Claimable pump fees below minimum (${Number(minClaim) / 1e9} SOL).`
            : undefined,
      };
    }

    if (dryRun) {
      return {
        claimableLamports,
        claimedLamports: claimableLamports,
        usesSharingConfig,
      };
    }

    const signature = await sendPumpClaimTransaction({
      connection,
      onlineSdk,
      authority,
      mint,
      usesSharingConfig,
    });

    return {
      claimableLamports,
      claimedLamports: claimableLamports,
      usesSharingConfig,
      signature,
    };
  } catch (error) {
    return {
      claimableLamports: BigInt(0),
      claimedLamports: BigInt(0),
      usesSharingConfig: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
