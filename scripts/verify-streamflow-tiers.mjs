import fs from "node:fs";
import path from "node:path";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ICluster } from "@streamflow/common";
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

const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim();
const connection = new Connection(rpcUrl, "confirmed");
const client = new SolanaStakingClient({
  clusterUrl: rpcUrl,
  cluster: ICluster.Mainnet,
});
const mint =
  process.env.NEXT_PUBLIC_MEDUSA_TOKEN_MINT?.trim() ||
  "HYdWaJRTW4vVTFPjUaUV7J7JXHzxMnvogBr4ZFupump";
const rewardDynamic = new PublicKey(
  constants.REWARD_POOL_DYNAMIC_PROGRAM_ID[ICluster.Mainnet],
);

const tiers = [
  {
    days: 7,
    stakePool: "6HtvP9VKSxvfe2kdnZDCiSwgDnRYaJjMLEdJPfCpn86G",
    rewardPool: "9Tum3seCmGRjvHAVRivNw4z1SX9YpCaDkXFv9k4yokm9",
    fundDelegate: "8goynXrEhVqdFd6wcNSbKUL9Cz3tEzyUcnGnbrCLZNL8",
    topUp: "9AXSVkhRBjk5YhiH8WdFt75EbrCBe37vMD5RhYxdQohR",
  },
  {
    days: 30,
    stakePool: "Am9wVQVVftYvv6VVFHk4o3cqscwDnpjfGV5uFGz9jQ48",
    rewardPool: "atx35ABujkz7wadg7j779C8KkKBPE5DaWLYsMB3xkHw",
    fundDelegate: "5tYitqsbFcwWyDS8NYawZ1dteqMy2PguSBXZi63WKUUS",
    topUp: "5SEiWDzehLZxdTBZQaUNExLzbsnwXsY1hpD4E9QsmrRg",
  },
  {
    days: 90,
    stakePool: "9ytm6H4BHPfcU2UFi6LNaxqn57JaWqRApGr2V7RSjhaf",
    rewardPool: "9YJfse8BrLmdPDAU3AMzTHu6ZhVgpAQ5LFNREVcDuyRu",
    fundDelegate: "4GZZu6xRShNJ4ZS2Vuaj5DpWoZxAsMFcJrNLE6t1koyk",
    topUp: "ANkFBLyFbPymfgiH9Bdd47fY1jHh6wVJrHPXCJaGgwZ9",
  },
  {
    days: 180,
    stakePool: "8WYMr8daoK7inJnvK1DuCbpaQqYCDwrXsLLSvCvFU17L",
    rewardPool: "38RytrUWn1AZvqcJtVifaUmGu6aJ8LwAPf53GJU33JZb",
    fundDelegate: "42ZrmAKwDqGMuPet9GZXk4t11GVBmF2AtMmEFJzSVXtr",
    topUp: "GMFyjSV5CDXNNmj4TvPtpVrktsMQap883BdRhxq4rb1L",
  },
];

console.log("Verifying authoritative pool map vs user top-up addresses\n");

for (const tier of tiers) {
  const derivedDelegate = deriveFundDelegatePDA(
    rewardDynamic,
    new PublicKey(tier.rewardPool),
  );
  const derivedTopUp = getAssociatedTokenAddressSync(
    new PublicKey(mint),
    derivedDelegate,
    true,
    TOKEN_2022_PROGRAM_ID,
  );

  console.log(`${tier.days}d`);
  console.log(`  stake pool:    ${tier.stakePool}`);
  console.log(`  reward pool:   ${tier.rewardPool}`);
  console.log(`  fund delegate: ${tier.fundDelegate} (derived ${derivedDelegate.toBase58()})`);
  console.log(`  top-up:        ${tier.topUp} (derived ${derivedTopUp.toBase58()})`);
  console.log(
    `  checks: delegate=${tier.fundDelegate === derivedDelegate.toBase58() ? "ok" : "MISMATCH"}, topup=${tier.topUp === derivedTopUp.toBase58() ? "ok" : "MISMATCH"}`,
  );

  const pool = await client.getStakePool(tier.stakePool);
  const lockDays = Number(pool.minDuration.toString()) / 86400;
  console.log(`  on-chain lock: ${lockDays}d`);

  try {
    const bal = await connection.getTokenAccountBalance(new PublicKey(tier.topUp));
    console.log(`  top-up balance: ${bal.value.uiAmountString ?? bal.value.amount} MEDUSA`);
  } catch {
    console.log("  top-up balance: account empty or unreadable");
  }
  console.log("");
}

const userMystery = [
  "BjZ58rMr2xRoENZcivnzCCLV6da6aCTZ9iMN4PQLhdCH",
  "2CBVvWg1vdXfhVphcduNCKZscmmMfsrd4VsNrAqs8T57",
  "EevQbH2LAAn61XfhyLvhr8xmG1yMGMv4nPjeaqhgCUQj",
];
console.log("User 'pool' labels for 30/90/180 (not stake pools):");
for (const addr of userMystery) {
  console.log(`  ${addr} — not a stake pool; Streamflow UI likely showed reward-pool id with wrong label`);
}
