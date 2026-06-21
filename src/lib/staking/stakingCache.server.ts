import { getRedis } from "@/lib/kv.server";

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const memoryCache = new Map<string, CacheEntry>();
const staleCache = new Map<string, unknown>();

function readMemory<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }
  return null;
}

function readStale<T>(key: string): T | null {
  const fresh = readMemory<T>(key);
  if (fresh !== null) {
    return fresh;
  }
  const stale = staleCache.get(key);
  return stale !== undefined ? (stale as T) : null;
}

function writeMemory(key: string, ttlSeconds: number, value: unknown): void {
  memoryCache.set(key, {
    expiresAt: Date.now() + ttlSeconds * 1000,
    value,
  });
  staleCache.set(key, value);
}

export async function withStakingCache<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const memoryHit = readMemory<T>(key);
  if (memoryHit !== null) {
    return memoryHit;
  }

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        writeMemory(key, ttlSeconds, cached);
        staleCache.set(key, cached);
        return cached;
      }
    } catch (error) {
      console.error(`[staking/cache] redis read ${key}`, error);
    }
  }

  try {
    const value = await loader();
    writeMemory(key, ttlSeconds, value);
    if (redis) {
      try {
        await redis.set(key, value, { ex: ttlSeconds });
      } catch (error) {
        console.error(`[staking/cache] redis write ${key}`, error);
      }
    }
    return value;
  } catch (error) {
    const stale = readStale<T>(key);
    if (stale !== null) {
      console.error(`[staking/cache] loader failed, returning stale ${key}`, error);
      return stale;
    }
    throw error;
  }
}

export async function readStakingCache<T>(key: string): Promise<T | null> {
  const memoryHit = readMemory<T>(key);
  if (memoryHit !== null) {
    return memoryHit;
  }

  const redis = getRedis();
  if (!redis) {
    return readStale<T>(key);
  }

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null && cached !== undefined) {
      writeMemory(key, STAKING_CACHE_TTL.statsSeconds, cached);
      staleCache.set(key, cached);
      return cached;
    }
  } catch (error) {
    console.error(`[staking/cache] redis read ${key}`, error);
  }

  return readStale<T>(key);
}

export const STAKING_CACHE_KEYS = {
  stats: "medusa:staking:stats",
  activeStakers: "medusa:staking:active-stakers",
  position: (wallet: string) => `medusa:staking:position:${wallet.toLowerCase()}`,
} as const;

export const STAKING_CACHE_TTL = {
  statsSeconds: 120,
  activeStakersSeconds: 600,
  positionSeconds: 90,
} as const;
