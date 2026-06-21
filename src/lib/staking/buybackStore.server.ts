import { getRedis, KV_KEYS } from "@/lib/kv.server";
import type { BuybackRunRecord } from "@/lib/staking/types";

const HISTORY_LIMIT = 50;

export async function getLastBuybackRun(): Promise<BuybackRunRecord | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  return (await redis.get<BuybackRunRecord>(KV_KEYS.buybackLastRun)) ?? null;
}

export async function saveBuybackRun(record: BuybackRunRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  await redis.set(KV_KEYS.buybackLastRun, record);
  await redis.lpush(KV_KEYS.buybackHistory, record);
  await redis.ltrim(KV_KEYS.buybackHistory, 0, HISTORY_LIMIT - 1);
}

export async function listBuybackHistory(
  limit = 20,
): Promise<BuybackRunRecord[]> {
  const redis = getRedis();
  if (!redis) {
    return [];
  }
  return (await redis.lrange<BuybackRunRecord>(KV_KEYS.buybackHistory, 0, limit - 1)) ?? [];
}
