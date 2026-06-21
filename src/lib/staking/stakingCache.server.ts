import { getRedis } from "@/lib/kv.server";

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();

export async function withStakingCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const memoryHit = memoryCache.get(key);
  if (memoryHit && memoryHit.expiresAt > now) {
    return memoryHit.value as T;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        memoryCache.set(key, {
          expiresAt: now + ttlSeconds * 1000,
          value: cached,
        });
        return cached;
      }
    } catch (error) {
      console.error(`[staking/cache] redis read ${key}`, error);
    }
  }

  const value = await loader();
  memoryCache.set(key, {
    expiresAt: now + ttlSeconds * 1000,
    value,
  });

  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      console.error(`[staking/cache] redis write ${key}`, error);
    }
  }

  return value;
}

export const STAKING_CACHE_KEYS = {
  stats: "medusa:staking:stats",
  activeStakers: "medusa:staking:active-stakers",
  position: (wallet: string) => `medusa:staking:position:${wallet}`,
} as const;

export const STAKING_CACHE_TTL = {
  statsSeconds: 45,
  activeStakersSeconds: 300,
  positionSeconds: 30,
} as const;
