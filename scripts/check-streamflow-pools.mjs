import fs from "node:fs";
import path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { ICluster, getFilters } from "@streamflow/common";
import {
  SolanaStakingClient,
  constants,
  deriveFundDelegatePDA,
} from "@streamflow/staking";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

function formatDuration(bn) {
  const seconds = Number(bn?.toString?.() ?? bn ?? 0);
  const days = seconds / 86_400;
  return `${days.toFixed(2)} days (${seconds.toLocaleString()}s)`;
}

function formatWeight(bn) {
  const raw = Number(bn?.toString?.() ?? bn ?? 0);
  const multiplier = raw / 1_000_000_000;
  return `${multiplier}x (${raw.toLocaleString()} raw)`;
}

function formatTs(bn) {
  const seconds = Number(bn?.toString?.() ?? bn ?? 0);
  if (!seconds) return "none";
  return new Date(seconds * 1000).toISOString();
}

function formatTokenAmount(raw, decimals = 6) {
  const value = Number(raw?.toString?.() ?? raw ?? 0) / 10 ** decimals;
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

async function printFundDelegate(connection, rewardPoolPubkey, rewardMint, dynamic = true) {
  const programId = new PublicKey(
    dynamic
      ? constants.REWARD_POOL_DYNAMIC_PROGRAM_ID[ICluster.Mainnet]
      : constants.REWARD_POOL_PROGRAM_ID[ICluster.Mainnet],
  );
  const delegatePda = deriveFundDelegatePDA(
    programId,
    new PublicKey(rewardPoolPubkey),
  );
  const tokenAccount = getAssociatedTokenAddressSync(
    new PublicKey(rewardMint),
    delegatePda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`      fund delegate PDA: ${delegatePda.toBase58()}`);
  console.log(`      fund delegate ATA: ${tokenAccount.toBase58()}`);

  const info = await connection.getAccountInfo(tokenAccount);
  if (!info) {
    console.log("      delegate balance: 0 (ATA not created yet)");
    return;
  }

  const balance = await connection.getTokenAccountBalance(tokenAccount);
  console.log(
    `      delegate balance: ${balance.value.uiAmountString ?? balance.value.amount} tokens`,
  );
}

async function printStakePool(client, connection, entry) {
  const pool = entry.account;
  const address = entry.publicKey.toBase58();

  console.log("\n" + "=".repeat(72));
  console.log(`Stake pool: ${address}`);
  console.log(`  mint:                 ${pool.mint.toBase58()}`);
  console.log(`  creator:              ${pool.creator.toBase58()}`);
  console.log(`  min duration:         ${formatDuration(pool.minDuration)}`);
  console.log(`  max duration:         ${formatDuration(pool.maxDuration)}`);
  console.log(`  max weight:           ${formatWeight(pool.maxWeight)}`);
  console.log(`  total stake:          ${formatTokenAmount(pool.totalStake)}`);
  console.log(
    `  total effective stake:${formatTokenAmount(pool.totalEffectiveStake, 9)} (weighted)`,
  );
  console.log(`  permissionless:       ${pool.permissionless}`);
  console.log(`  auto unstake:         ${pool.autoUnstake ?? false}`);
  console.log(`  expiry:               ${formatTs(pool.expiryTs)}`);
  console.log(`  stake mint (receipt): ${pool.stakeMint.toBase58()}`);
  console.log(`  vault:                ${pool.vault.toBase58()}`);

  await printRewardPools(client, connection, address);
}

async function printRewardPools(client, connection, stakePoolAddress) {
  const { rewardPoolProgram, rewardPoolDynamicProgram } = client.programs;
  const criteria = { stakePool: stakePoolAddress };

  const fixedPools = await rewardPoolProgram.account.rewardPool.all(
    getFilters(criteria, constants.REWARD_POOL_BYTE_OFFSETS),
  );
  const dynamicPools = await rewardPoolDynamicProgram.account.rewardPool.all(
    getFilters(criteria, constants.REWARD_POOL_BYTE_OFFSETS),
  );

  const allPools = [
    ...fixedPools.map((entry) => ({ ...entry, poolType: "fixed" })),
    ...dynamicPools.map((entry) => ({ ...entry, poolType: "dynamic" })),
  ];

  if (allPools.length === 0) {
    console.log("  reward pools:         none found");
    return;
  }

  console.log(`  reward pools:         ${allPools.length}`);
  for (const rewardEntry of allPools) {
    const reward = rewardEntry.account;
    const rewardAddress = rewardEntry.publicKey.toBase58();
    console.log(`    - ${rewardAddress} (${rewardEntry.poolType})`);
    console.log(`      reward mint:        ${reward.mint.toBase58()}`);
    if (reward.rewardAmount) {
      console.log(
        `      reward amount:      ${formatTokenAmount(reward.rewardAmount, 9)} per effective token (9-dec precision)`,
      );
    }
    if (reward.rewardPeriod) {
      console.log(
        `      reward period:      ${formatDuration(reward.rewardPeriod)}`,
      );
    }
    console.log(`      permissionless:     ${reward.permissionless}`);

    if (rewardEntry.poolType === "dynamic") {
      try {
        await printFundDelegate(connection, rewardAddress, reward.mint, true);
      } catch (error) {
        console.log(
          `      fund delegate:      unavailable (${error instanceof Error ? error.message : error})`,
        );
      }
    }
  }
}

loadEnv();

const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  "https://api.mainnet-beta.solana.com";
const mint =
  process.argv.find((arg) => arg.startsWith("--mint="))?.slice("--mint=".length) ||
  process.env.NEXT_PUBLIC_MEDUSA_TOKEN_MINT?.trim() ||
  "HYdWaJRTW4vVTFPjUaUV7J7JXHzxMnvogBr4ZFupump";
const stakePoolArg = process.argv[2];

const cluster =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK?.includes("devnet")
    ? ICluster.Devnet
    : ICluster.Mainnet;

console.log(`RPC:     ${rpcUrl}`);
console.log(`Cluster: ${cluster}`);
console.log(`Mint:    ${mint}`);

const client = new SolanaStakingClient({ clusterUrl: rpcUrl, cluster });
const connection = new Connection(rpcUrl, "confirmed");

if (stakePoolArg && stakePoolArg.length > 30) {
  console.log(`\nFetching stake pool by address: ${stakePoolArg}`);
  const pool = await client.getStakePool(stakePoolArg);
  await printStakePool(client, connection, {
    publicKey: new PublicKey(stakePoolArg),
    account: pool,
  });
  process.exit(0);
}

console.log("\nSearching stake pools for mint...");
const pools = await client.searchStakePools({ mint });

if (pools.length === 0) {
  console.log("\nNo stake pools found for this mint.");
  console.log("If you already created one, pass its address:");
  console.log("  node scripts/check-streamflow-pools.mjs <STAKE_POOL_ADDRESS>");
  process.exit(0);
}

console.log(`Found ${pools.length} stake pool(s).`);
for (const entry of pools) {
  await printStakePool(client, connection, entry);
}
