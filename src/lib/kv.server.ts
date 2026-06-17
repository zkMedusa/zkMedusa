import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

/**
 * Returns a shared Upstash Redis (REST) client when configured, otherwise null.
 * Supports both Vercel KV env names (KV_REST_API_*) and native Upstash names.
 * When null, stores fall back to the local filesystem (dev only).
 */
export function getRedis(): Redis | null {
  if (cached !== undefined) {
    return cached;
  }

  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}

export const KV_KEYS = {
  nullifiers: "medusa:nullifiers",
  registrations: "medusa:registrations",
  badges: "medusa:badges",
} as const;

export function registrationField(
  campaignId: string,
  nullifier: string,
): string {
  return `${campaignId}::${nullifier}`;
}
