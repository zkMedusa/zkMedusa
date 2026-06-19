import fs from "node:fs";
import path from "node:path";
import { getRedis, KV_KEYS, tokenHolderField } from "@/lib/kv.server";

export interface TokenHolderRecord {
  partnerId: string;
  /** Opaque HMAC of the address. Never the raw wallet. */
  holderId: string;
  eligible: boolean;
  threshold: string;
  expiresAt: string;
  lastChecked: string;
  /**
   * AES-256-GCM encrypted address. Only present when an encryption key is set;
   * required for the daily cron to re-query balances without the user present.
   */
  addressEnc?: string;
  /** Telegram handle linked at verification (normalized, no @). */
  telegramUsername?: string;
}

function getDataDir(): string {
  // Vercel/Lambda filesystems are read-only except /tmp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "medusa-passport");
  }
  return path.join(process.cwd(), ".data");
}

const DATA_DIR = getDataDir();
const HOLDERS_FILE = path.join(DATA_DIR, "token-holders.json");

function readHolders(): TokenHolderRecord[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HOLDERS_FILE)) {
    fs.writeFileSync(HOLDERS_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(HOLDERS_FILE, "utf8")) as TokenHolderRecord[];
}

function writeHolders(holders: TokenHolderRecord[]): void {
  fs.writeFileSync(HOLDERS_FILE, JSON.stringify(holders, null, 2));
}

/** Upserts a holder record keyed by the opaque holderId. */
export async function saveTokenHolder(
  record: TokenHolderRecord,
): Promise<TokenHolderRecord> {
  const redis = getRedis();
  if (redis) {
    await redis.hset(KV_KEYS.tokenHolders, {
      [tokenHolderField(record.partnerId, record.holderId)]: record,
    });
    return record;
  }

  const holders = readHolders();
  const index = holders.findIndex(
    (entry) =>
      entry.partnerId === record.partnerId &&
      entry.holderId === record.holderId,
  );
  if (index >= 0) {
    holders[index] = record;
  } else {
    holders.push(record);
  }
  writeHolders(holders);
  return record;
}

export async function getTokenHolder(
  partnerId: string,
  holderId: string,
): Promise<TokenHolderRecord | null> {
  const redis = getRedis();
  if (redis) {
    return (
      (await redis.hget<TokenHolderRecord>(
        KV_KEYS.tokenHolders,
        tokenHolderField(partnerId, holderId),
      )) ?? null
    );
  }

  return (
    readHolders().find(
      (entry) =>
        entry.partnerId === partnerId && entry.holderId === holderId,
    ) ?? null
  );
}

/** All holder records across every partner (used by the refresh cron). */
export async function listAllTokenHolders(): Promise<TokenHolderRecord[]> {
  const redis = getRedis();
  if (redis) {
    const all =
      (await redis.hgetall<Record<string, TokenHolderRecord>>(
        KV_KEYS.tokenHolders,
      )) ?? {};
    return Object.values(all);
  }

  return readHolders();
}

async function listTokenHolders(
  partnerId: string,
): Promise<TokenHolderRecord[]> {
  return (await listAllTokenHolders()).filter(
    (entry) => entry.partnerId === partnerId,
  );
}

export async function findTokenHolderByTelegram(
  partnerId: string,
  telegramUsername: string,
): Promise<TokenHolderRecord | null> {
  const normalized = telegramUsername.toLowerCase();
  const holders = await listTokenHolders(partnerId);
  return (
    holders.find((entry) => entry.telegramUsername === normalized) ?? null
  );
}

/** Partner-facing roster: Telegram + effective eligibility only (no balances). */
export async function listPartnerTokenRoster(partnerId: string): Promise<
  Array<{ telegramUsername: string; eligible: boolean }>
> {
  const now = Date.now();
  const holders = await listTokenHolders(partnerId);

  return holders
    .filter((entry): entry is TokenHolderRecord & { telegramUsername: string } =>
      Boolean(entry.telegramUsername),
    )
    .map((entry) => ({
      telegramUsername: entry.telegramUsername,
      eligible:
        entry.eligible && new Date(entry.expiresAt).getTime() > now,
    }))
    .sort((a, b) => a.telegramUsername.localeCompare(b.telegramUsername));
}

/** Anonymous dashboard counts (no addresses revealed). */
export async function getTokenHolderStats(partnerId: string): Promise<{
  total: number;
  eligible: number;
  eligibleActive: number;
}> {
  const now = Date.now();
  const holders = await listTokenHolders(partnerId);

  return {
    total: holders.length,
    eligible: holders.filter((entry) => entry.eligible).length,
    eligibleActive: holders.filter(
      (entry) => entry.eligible && new Date(entry.expiresAt).getTime() > now,
    ).length,
  };
}
