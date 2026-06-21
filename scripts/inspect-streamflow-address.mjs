import fs from "node:fs";
import path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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

loadEnv();

const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpcUrl, "confirmed");
const client = new SolanaStakingClient({
  clusterUrl: rpcUrl,
  cluster: ICluster.Mainnet,
});

const STAKE_PROGRAM = constants.STAKE_POOL_PROGRAM_ID[ICluster.Mainnet];
const REWARD_DYNAMIC = constants.REWARD_POOL_DYNAMIC_PROGRAM_ID[ICluster.Mainnet];
const mint = process.env.NEXT_PUBLIC_MEDUSA_TOKEN_MINT?.trim() ||
  "HYdWaJRTW4vVTFPjUaUV7J7JXHzxMnvogBr4ZFupump";

const userPairs = [
  { tier: "7d", pool: "8goynXrEhVqdFd6wcNSbKUL9Cz3tEzyUcnGnbrCLZNL8", topup: "9AXSVkhRBjk5YhiH8WdFt75EbrCBe37vMD5RhYxdQohR" },
  { tier: "30d", pool: "BjZ58rMr2xRoENZcivnzCCLV6da6aCTZ9iMN4PQLhdCH", topup: "5SEiWDzehLZxdTBZQaUNExLzbsnwXsY1hpD4E9QsmrRg" },
  { tier: "90d", pool: "2CBVvWg1vdXfhVphcduNCKZscmmMfsrd4VsNrAqs8T57", topup: "ANkFBLyFbPymfgiH9Bdd47fY1jHh6wVJrHPXCJaGgwZ9" },
  { tier: "180d", pool: "EevQbH2LAAn61XfhyLvhr8xmG1yMGMv4nPjeaqhgCUQj", topup: "GMFyjSV5CDXNNmj4TvPtpVrktsMQap883BdRhxq4rb1L" },
];

async function describeAddress(label, address) {
  const pk = new PublicKey(address);
  const info = await connection.getAccountInfo(pk);
  if (!info) {
    console.log(`  ${label}: ${address} -> NOT FOUND`);
    return;
  }
  console.log(`  ${label}: ${address}`);
  console.log(`    owner: ${info.owner.toBase58()}`);
  console.log(`    lamports: ${info.lamports}`);
  console.log(`    data len: ${info.data.length}`);

  if (info.owner.toBase58() === STAKE_PROGRAM) {
    try {
      const pool = await client.getStakePool(address);
      const days = Number(pool.minDuration.toString()) / 86400;
      console.log(`    type: STAKE POOL (${days}d lock)`);
      console.log(`    stake pool mint: ${pool.mint.toBase58()}`);
    } catch (e) {
      console.log(`    type: stake program account (decode failed)`);
    }
  } else if (info.owner.toBase58() === REWARD_DYNAMIC) {
    try {
      const { rewardPoolDynamicProgram } = client.programs;
      const fd = await rewardPoolDynamicProgram.account.fundDelegate.fetch(address);
      console.log(`    type: FUND DELEGATE PDA`);
      console.log(`    reward pool: ${fd.rewardPool.toBase58()}`);
      console.log(`    start: ${new Date(Number(fd.startTs) * 1000).toISOString()}`);
      console.log(`    period: ${Number(fd.period) / 86400} days`);
      console.log(`    expiry: ${new Date(Number(fd.expiryTs) * 1000).toISOString()}`);
    } catch {
      try {
        const rp = await client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(address);
        console.log(`    type: REWARD POOL`);
        console.log(`    stake pool: ${rp.stakePool.toBase58()}`);
      } catch {
        console.log(`    type: dynamic reward program account`);
      }
    }
  } else if (info.owner.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
    const bal = await connection.getTokenAccountBalance(pk);
    console.log(`    type: SPL TOKEN ACCOUNT`);
    console.log(`    mint: ${bal.value.uiAmountString} tokens (mint via parsed)`);
    const parsed = await connection.getParsedAccountInfo(pk);
    const data = parsed.value?.data;
    if (data && "parsed" in data) {
      console.log(`    token mint: ${data.parsed.info.mint}`);
      console.log(`    token owner: ${data.parsed.info.owner}`);
      console.log(`    balance: ${data.parsed.info.tokenAmount.uiAmountString}`);
    }
  }
}

console.log("=== User-provided addresses ===\n");
for (const pair of userPairs) {
  console.log(`Tier ${pair.tier}:`);
  await describeAddress("pool label", pair.pool);
  await describeAddress("topup label", pair.topup);
  console.log("");
}

console.log("\n=== User reward pool labels -> full mapping ===\n");
const userRewardPools = [
  { tier: "7d", rewardPool: "9Tum3seCmGRjvHAVRivNw4z1SX9YpCaDkXFv9k4yokm9", topup: "9AXSVkhRBjk5YhiH8WdFt75EbrCBe37vMD5RhYxdQohR" },
  { tier: "30d", rewardPool: "BjZ58rMr2xRoENZcivnzCCLV6da6aCTZ9iMN4PQLhdCH", topup: "5SEiWDzehLZxdTBZQaUNExLzbsnwXsY1hpD4E9QsmrRg" },
  { tier: "90d", rewardPool: "2CBVvWg1vdXfhVphcduNCKZscmmMfsrd4VsNrAqs8T57", topup: "ANkFBLyFbPymfgiH9Bdd47fY1jHh6wVJrHPXCJaGgwZ9" },
  { tier: "180d", rewardPool: "EevQbH2LAAn61XfhyLvhr8xmG1yMGMv4nPjeaqhgCUQj", topup: "GMFyjSV5CDXNNmj4TvPtpVrktsMQap883BdRhxq4rb1L" },
];

const { TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");

for (const entry of userRewardPools) {
  const rp = await client.programs.rewardPoolDynamicProgram.account.rewardPool.fetch(
    entry.rewardPool,
  );
  const stakePool = rp.stakePool.toBase58();
  const pool = await client.getStakePool(stakePool);
  const days = Number(pool.minDuration.toString()) / 86400;
  const delegatePda = deriveFundDelegatePDA(
    new PublicKey(REWARD_DYNAMIC),
    new PublicKey(entry.rewardPool),
  );
  const topupClassic = getAssociatedTokenAddressSync(
    new PublicKey(mint),
    delegatePda,
    true,
  );
  const topup2022 = getAssociatedTokenAddressSync(
    new PublicKey(mint),
    delegatePda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`${entry.tier} (on-chain ${days}d)`);
  console.log(`  stake pool:      ${stakePool}`);
  console.log(`  reward pool:     ${entry.rewardPool}`);
  console.log(`  fund delegate:   ${delegatePda.toBase58()}`);
  console.log(`  top-up (UI):     ${entry.topup}`);
  console.log(`  top-up (classic):${topupClassic.toBase58()}`);
  console.log(`  top-up (2022):   ${topup2022.toBase58()}`);
  console.log(`  UI top-up match: ${entry.topup === topup2022.toBase58() ? "token-2022 ATA" : entry.topup === topupClassic.toBase58() ? "classic ATA" : "custom/other"}`);
  console.log("");
}
