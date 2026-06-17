import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createCollection } from "@metaplex-foundation/mpl-core";

// Minimal .env loader so the script can be run standalone.
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) {
      continue;
    }
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

function decodeSecretKey(secret) {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    return Uint8Array.from(JSON.parse(trimmed));
  }
  return bs58.decode(trimmed);
}

// Confirm by polling over HTTP so it works on RPCs without a WebSocket endpoint.
async function confirmSignatureHttp(rpcUrl, signature, timeoutMs = 90_000) {
  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }
    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(`Timed out confirming ${signature}.`);
}

async function main() {
  loadEnv();

  const rpcUrl =
    process.env.MEDUSA_BADGE_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.devnet.solana.com";

  const secret = process.env.MEDUSA_BADGE_AUTHORITY_SECRET_KEY?.trim();

  const umi = createUmi(rpcUrl);

  if (!secret) {
    const keypair = umi.eddsa.generateKeypair();
    console.log(
      "No MEDUSA_BADGE_AUTHORITY_SECRET_KEY found. Generated a new badge authority:\n",
    );
    console.log(`MEDUSA_BADGE_AUTHORITY_SECRET_KEY=${bs58.encode(keypair.secretKey)}`);
    console.log(`# public key: ${keypair.publicKey}`);
    console.log(
      "\nFund this address with a little SOL, add the secret to your .env, then re-run this script.",
    );
    return;
  }

  const keypair = umi.eddsa.createKeypairFromSecretKey(decodeSecretKey(secret));
  umi.use(keypairIdentity(createSignerFromKeypair(umi, keypair)));

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://zkmedusa.com").replace(
    /\/$/,
    "",
  );

  const collectionMetadata = {
    name: "Medusa Passport",
    symbol: "MEDUSA",
    description:
      "Soulbound Medusa Privacy Passport badges. Non-transferable proof of a cleared reputation tier.",
    external_url: appUrl,
  };
  const uri = `data:application/json;base64,${Buffer.from(
    JSON.stringify(collectionMetadata),
    "utf8",
  ).toString("base64")}`;

  const collection = generateSigner(umi);

  console.log(`Authority: ${umi.identity.publicKey}`);
  console.log(`RPC:       ${rpcUrl}`);

  const connection = new Connection(rpcUrl, { commitment: "confirmed" });
  const balance = await connection.getBalance(
    new PublicKey(umi.identity.publicKey.toString()),
  );
  console.log(`Balance:   ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance < 5_000_000) {
    throw new Error(
      "Authority balance is too low to create a collection (~0.003 SOL needed). Fund it and re-run.",
    );
  }

  console.log(`Creating collection ${collection.publicKey} ...`);

  const signature = bs58.encode(
    await createCollection(umi, {
      collection,
      name: "Medusa Passport",
      uri,
    }).send(umi),
  );
  await confirmSignatureHttp(rpcUrl, signature);

  console.log("\nCollection created. Add this to your .env:\n");
  console.log(`MEDUSA_BADGE_COLLECTION=${collection.publicKey}`);
  console.log(`NEXT_PUBLIC_MEDUSA_BADGE_COLLECTION=${collection.publicKey}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
