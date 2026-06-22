"use client";

import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
  type Connection,
  type TransactionInstruction,
  type VersionedTransaction,
} from "@solana/web3.js";
import type { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { getSolanaNetwork, getSolanaRpcUrl } from "@/lib/passport/config";
import { medusaAmountToRaw } from "@/lib/staking/amounts";
import { getMedusaMintAddress } from "@/lib/staking/config";
import {
  getStreamflowTier,
  getStreamflowTierPools,
} from "@/lib/staking/streamflowPools";
import type { StakingTierPosition } from "@/lib/staking/types";

type StakingClientModule = typeof import("@streamflow/staking");
type CommonModule = typeof import("@streamflow/common");

let sdkPromise: Promise<{
  client: InstanceType<StakingClientModule["SolanaStakingClient"]>;
}> | null = null;

async function getStakingClient() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const [{ ICluster }, { SolanaStakingClient }] = await Promise.all([
        import("@streamflow/common") as Promise<CommonModule>,
        import("@streamflow/staking") as Promise<StakingClientModule>,
      ]);
      const cluster =
        getSolanaNetwork() === "mainnet-beta"
          ? ICluster.Mainnet
          : ICluster.Devnet;
      return {
        client: new SolanaStakingClient({
          clusterUrl: getSolanaRpcUrl(),
          cluster,
        }),
      };
    })();
  }
  return sdkPromise;
}

type WalletSendTransaction = (
  transaction: Transaction | VersionedTransaction,
  connection: Connection,
) => Promise<string>;

function getInvoker(
  wallet: SignerWalletAdapter,
  publicKey: PublicKey,
): SignerWalletAdapter {
  if (wallet.publicKey?.equals(publicKey)) {
    return wallet;
  }
  return { ...wallet, publicKey } as SignerWalletAdapter;
}

async function getDynamicClaimGovernorArgs(
  client: InstanceType<StakingClientModule["SolanaStakingClient"]>,
  rewardPoolAddress: string,
): Promise<{ governor?: PublicKey }> {
  const rewardPool =
    await client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
      rewardPoolAddress,
    );

  if (rewardPool.governor.equals(PublicKey.default)) {
    return { governor: null as unknown as undefined };
  }

  return { governor: rewardPool.governor };
}

async function executeStreamflowInstructions(
  connection: Connection,
  invoker: SignerWalletAdapter,
  sendTransaction: WalletSendTransaction,
  ixs: TransactionInstruction[],
): Promise<string> {
  const [
    {
      createAndEstimateTransaction,
      prepareBaseInstructions,
      prepareTransaction,
      unwrapExecutionParams,
    },
  ] = await Promise.all([import("@streamflow/common") as Promise<CommonModule>]);

  const executionParams = unwrapExecutionParams({ invoker }, connection);
  const preparedIxs = await createAndEstimateTransaction(
    async (params) =>
      prepareBaseInstructions(connection, params).concat(ixs),
    executionParams,
  );
  const { tx } = await prepareTransaction(
    connection,
    preparedIxs,
    invoker.publicKey!,
  );

  return sendTransaction(tx, connection);
}

async function findAvailableStakeNonce(
  client: InstanceType<StakingClientModule["SolanaStakingClient"]>,
  stakePool: string,
  wallet: string,
): Promise<number> {
  const entries = await client.searchStakeEntries({
    stakePool: new PublicKey(stakePool),
    payer: new PublicKey(wallet),
  });
  const used = new Set(entries.map((entry) => entry.account.nonce));
  for (let nonce = 0; nonce < 256; nonce += 1) {
    if (!used.has(nonce)) {
      return nonce;
    }
  }
  throw new Error("Maximum number of stake positions reached for this pool.");
}

async function ensureStakeTokenAccounts(
  connection: Connection,
  wallet: SignerWalletAdapter,
  sendTransaction: WalletSendTransaction,
  mint: PublicKey,
  stakePool: PublicKey,
): Promise<void> {
  const owner = wallet.publicKey!;
  const userAta = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  const { client } = await getStakingClient();
  const stakePoolAccount = await client.getStakePool(stakePool);
  const stakeMintAta = getAssociatedTokenAddressSync(
    stakePoolAccount.stakeMint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const instructions = [
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      userAta,
      owner,
      mint,
      TOKEN_2022_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      owner,
      stakeMintAta,
      owner,
      stakePoolAccount.stakeMint,
      TOKEN_2022_PROGRAM_ID,
    ),
  ];

  const tx = new Transaction().add(...instructions);
  await sendTransaction(tx, connection);
}

export async function stakeMedusa({
  wallet,
  publicKey,
  connection,
  sendTransaction,
  tierDays,
  amount,
}: {
  wallet: SignerWalletAdapter;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: WalletSendTransaction;
  tierDays: number;
  amount: string;
}): Promise<string> {
  const tier = getStreamflowTier(tierDays);
  if (!tier) {
    throw new Error("Unknown staking tier.");
  }

  const invoker = getInvoker(wallet, publicKey);
  const mint = new PublicKey(getMedusaMintAddress());
  const { client } = await getStakingClient();
  const stakePool = await client.getStakePool(tier.stakePool);
  const duration = stakePool.minDuration;
  const amountRaw = medusaAmountToRaw(amount);
  const nonce = await findAvailableStakeNonce(
    client,
    tier.stakePool,
    invoker.publicKey!.toBase58(),
  );
  const rewardPool =
    await client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
      tier.rewardPool,
    );

  await ensureStakeTokenAccounts(
    connection,
    invoker,
    sendTransaction,
    mint,
    new PublicKey(tier.stakePool),
  );

  const { ixs } = await client.prepareStakeAndCreateEntriesInstructions(
    {
      stakePool: tier.stakePool,
      stakePoolMint: mint.toBase58(),
      amount: amountRaw,
      duration,
      nonce,
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toBase58(),
      rewardPools: [
        {
          nonce: rewardPool.nonce,
          mint: mint.toBase58(),
          rewardPoolType: "dynamic",
        },
      ],
    },
    { invoker },
  );

  return executeStreamflowInstructions(
    connection,
    invoker,
    sendTransaction,
    ixs,
  );
}

export async function claimTierRewards({
  wallet,
  publicKey,
  connection,
  sendTransaction,
  position,
}: {
  wallet: SignerWalletAdapter;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: WalletSendTransaction;
  position: StakingTierPosition;
}): Promise<string> {
  const invoker = getInvoker(wallet, publicKey);
  const mint = getMedusaMintAddress();
  const { client } = await getStakingClient();
  const userAta = getAssociatedTokenAddressSync(
    new PublicKey(mint),
    invoker.publicKey!,
    false,
    TOKEN_2022_PROGRAM_ID,
  );

  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    invoker.publicKey!,
    userAta,
    invoker.publicKey!,
    new PublicKey(mint),
    TOKEN_2022_PROGRAM_ID,
  );
  const governorArgs = await getDynamicClaimGovernorArgs(
    client,
    position.rewardPool,
  );
  const claimIxs = await client.prepareClaimRewardsInstructions(
    {
      stakePool: position.stakePool,
      stakePoolMint: mint,
      rewardPoolNonce: position.rewardPoolNonce,
      depositNonce: position.stakeNonce,
      rewardMint: mint,
      rewardPoolType: "dynamic",
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toBase58(),
      ...governorArgs,
    },
    { invoker },
  );

  return executeStreamflowInstructions(
    connection,
    invoker,
    sendTransaction,
    [createAtaIx, ...claimIxs.ixs],
  );
}

export async function claimAllStakingRewards({
  wallet,
  publicKey,
  connection,
  sendTransaction,
  positions,
}: {
  wallet: SignerWalletAdapter;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: WalletSendTransaction;
  positions: StakingTierPosition[];
}): Promise<string> {
  const claimable = positions.filter(
    (position) => Number.parseFloat(position.claimableMedusa) > 0,
  );
  if (claimable.length === 0) {
    throw new Error("No rewards to claim yet.");
  }

  let lastSignature = "";
  for (const position of claimable) {
    lastSignature = await claimTierRewards({
      wallet,
      publicKey,
      connection,
      sendTransaction,
      position,
    });
  }
  return lastSignature;
}

export async function unstakeTier({
  wallet,
  publicKey,
  connection,
  sendTransaction,
  position,
}: {
  wallet: SignerWalletAdapter;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: WalletSendTransaction;
  position: StakingTierPosition;
}): Promise<string> {
  if (!position.canUnstake) {
    throw new Error("This stake is still locked.");
  }

  const invoker = getInvoker(wallet, publicKey);
  const mint = getMedusaMintAddress();
  const { client } = await getStakingClient();
  const governorArgs = await getDynamicClaimGovernorArgs(
    client,
    position.rewardPool,
  );
  const { ixs } = await client.prepareUnstakeAndClaimInstructions(
    {
      stakePool: position.stakePool,
      stakePoolMint: mint,
      nonce: position.stakeNonce,
      tokenProgramId: TOKEN_2022_PROGRAM_ID.toBase58(),
      rewardPools: [
        {
          nonce: position.rewardPoolNonce,
          mint,
          rewardPoolType: "dynamic",
          ...governorArgs,
        },
      ],
    },
    { invoker },
  );

  return executeStreamflowInstructions(
    connection,
    invoker,
    sendTransaction,
    ixs,
  );
}

export function getConfiguredStakingTiers() {
  return getStreamflowTierPools();
}
