import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { Connection } from "@solana/web3.js";
import {
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
  publicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { create, fetchCollection } from "@metaplex-foundation/mpl-core";
import {
  getBadgeAuthoritySecretKey,
  getBadgeCollectionAddress,
  getBadgeRpcUrl,
  getSolanaExplorerUrl,
  TIER_LABELS,
  type PassportTier,
} from "./config";
import { buildBadgeMetadataUri } from "./badge.shared";
import type { MedusaPassport } from "./types";

export interface BadgeRecord {
  nullifier: string;
  assetId: string;
  claimWallet: string;
  collection: string | null;
  tier: PassportTier;
  tierLabel: string;
  campaignId: string | null;
  signature: string;
  explorerUrl: string;
  mintedAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const BADGES_FILE = path.join(DATA_DIR, "passport-badges.json");

function readBadges(): BadgeRecord[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(BADGES_FILE)) {
    fs.writeFileSync(BADGES_FILE, JSON.stringify([]));
  }

  return JSON.parse(fs.readFileSync(BADGES_FILE, "utf8")) as BadgeRecord[];
}

function writeBadges(badges: BadgeRecord[]): void {
  fs.writeFileSync(BADGES_FILE, JSON.stringify(badges, null, 2));
}

export function getBadgeForNullifier(nullifier: string): BadgeRecord | null {
  return readBadges().find((entry) => entry.nullifier === nullifier) ?? null;
}

export function isBadgeMintingConfigured(): boolean {
  return Boolean(getBadgeAuthoritySecretKey());
}

function decodeSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();

  // Support a JSON byte array (Solana CLI keypair format) or a base58 string.
  if (trimmed.startsWith("[")) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }

  return bs58.decode(trimmed);
}

/**
 * Confirms a signature by polling `getSignatureStatuses` over HTTP. Avoids the
 * WebSocket signature subscription used by `sendAndConfirm`, which fails on RPCs
 * without a working WS endpoint ("ws error: Unexpected server response: 404").
 */
async function confirmSignatureHttp(
  signature: string,
  timeoutMs = 90_000,
): Promise<void> {
  const connection = new Connection(getBadgeRpcUrl(), {
    commitment: "confirmed",
  });
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

  throw new Error(
    `Timed out confirming badge mint (${signature}). The RPC may be slow or unavailable.`,
  );
}

function getUmi() {
  const secret = getBadgeAuthoritySecretKey();
  if (!secret) {
    throw new Error(
      "Badge minting is not configured. Set MEDUSA_BADGE_AUTHORITY_SECRET_KEY.",
    );
  }

  const umi = createUmi(getBadgeRpcUrl());
  const keypair = umi.eddsa.createKeypairFromSecretKey(decodeSecretKey(secret));
  umi.use(keypairIdentity(createSignerFromKeypair(umi, keypair)));
  return umi;
}

export interface MintBadgeParams {
  passport: MedusaPassport;
  claimWallet: string;
  campaignId?: string | null;
}

/**
 * Mints a soulbound (permanently frozen) MPL Core asset representing the
 * passport tier to the supplied claim wallet. Minting + update authority stays
 * with Medusa, so the asset can never be transferred by the holder.
 *
 * Idempotent per passport nullifier: re-calling returns the existing badge.
 */
export async function mintSoulboundBadge(
  params: MintBadgeParams,
): Promise<BadgeRecord> {
  const existing = getBadgeForNullifier(params.passport.nullifier);
  if (existing) {
    return existing;
  }

  const umi = getUmi();
  const asset = generateSigner(umi);

  const tier = params.passport.statement.tier;
  const tierLabel = TIER_LABELS[tier];
  const metadataInput = {
    tier,
    tierLabel,
    policyVersion: params.passport.statement.policyVersion,
    expiresAt: params.passport.expiresAt,
    nullifier: params.passport.nullifier,
  };

  const collectionAddress = getBadgeCollectionAddress();
  const collection = collectionAddress
    ? await fetchCollection(umi, publicKey(collectionAddress))
    : undefined;

  const builder = create(umi, {
    asset,
    name: `Medusa Passport — ${tierLabel}`,
    uri: buildBadgeMetadataUri(metadataInput),
    owner: publicKey(params.claimWallet),
    ...(collection ? { collection } : {}),
    plugins: [
      // Mint frozen and keep the freeze authority with Medusa => soulbound.
      { type: "PermanentFreezeDelegate", frozen: true },
      {
        type: "Attributes",
        attributeList: [
          { key: "tier", value: tierLabel },
          { key: "tierLevel", value: String(tier) },
          { key: "policyVersion", value: params.passport.statement.policyVersion },
          { key: "expiresAt", value: params.passport.expiresAt },
          { key: "nullifier", value: params.passport.nullifier },
          { key: "issuer", value: "medusa" },
        ],
      },
    ],
  });

  const signatureBytes = await builder.send(umi);
  const signature = bs58.encode(signatureBytes);
  await confirmSignatureHttp(signature);

  const assetId = asset.publicKey.toString();

  const record: BadgeRecord = {
    nullifier: params.passport.nullifier,
    assetId,
    claimWallet: params.claimWallet,
    collection: collectionAddress,
    tier,
    tierLabel,
    campaignId: params.campaignId?.trim() || null,
    signature,
    explorerUrl: getSolanaExplorerUrl(assetId, "address"),
    mintedAt: new Date().toISOString(),
  };

  const badges = readBadges();
  badges.push(record);
  writeBadges(badges);

  return record;
}
