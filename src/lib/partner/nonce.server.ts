import { randomBytes } from "node:crypto";
import { getRedis, nonceKey } from "@/lib/kv.server";

const NONCE_TTL_SECONDS = 5 * 60;

// Dev fallback when Redis isn't configured. Map of nonce -> expiry epoch ms.
const memoryNonces = new Map<string, number>();

function pruneMemory(): void {
  const now = Date.now();
  for (const [nonce, expiry] of memoryNonces) {
    if (expiry < now) {
      memoryNonces.delete(nonce);
    }
  }
}

/** Issues a one-time nonce, stored with a short TTL. */
export async function issueNonce(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const redis = getRedis();

  if (redis) {
    await redis.set(nonceKey(nonce), "1", { ex: NONCE_TTL_SECONDS });
  } else {
    pruneMemory();
    memoryNonces.set(nonce, Date.now() + NONCE_TTL_SECONDS * 1000);
  }

  return nonce;
}

/** Atomically consumes a nonce. Returns true only if it was valid and unused. */
export async function consumeNonce(nonce: string): Promise<boolean> {
  if (!nonce) {
    return false;
  }

  const redis = getRedis();
  if (redis) {
    const deleted = await redis.del(nonceKey(nonce));
    return deleted === 1;
  }

  pruneMemory();
  const expiry = memoryNonces.get(nonce);
  if (expiry && expiry >= Date.now()) {
    memoryNonces.delete(nonce);
    return true;
  }
  return false;
}
