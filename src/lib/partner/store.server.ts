import fs from "node:fs";
import path from "node:path";
import {
  getRedis,
  KV_KEYS,
  registrationField,
} from "@/lib/kv.server";
import type { PassportTier } from "@/lib/passport/config";

export interface PartnerRegistration {
  campaignId: string;
  nullifier: string;
  claimWallet: string;
  tier: PassportTier;
  tierLabel: string;
  registeredAt: string;
}

function getDataDir(): string {
  // Vercel/Lambda filesystems are read-only except /tmp.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "medusa-passport");
  }

  return path.join(process.cwd(), ".data");
}

const DATA_DIR = getDataDir();
const REGISTRATIONS_FILE = path.join(DATA_DIR, "partner-registrations.json");

function readRegistrations(): PartnerRegistration[] {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(REGISTRATIONS_FILE)) {
    fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify([]));
  }

  return JSON.parse(
    fs.readFileSync(REGISTRATIONS_FILE, "utf8"),
  ) as PartnerRegistration[];
}

function writeRegistrations(registrations: PartnerRegistration[]): void {
  fs.writeFileSync(
    REGISTRATIONS_FILE,
    JSON.stringify(registrations, null, 2),
  );
}

export async function hasCampaignRegistration(
  campaignId: string,
  nullifier: string,
): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    return (
      (await redis.hexists(
        KV_KEYS.registrations,
        registrationField(campaignId, nullifier),
      )) === 1
    );
  }

  return readRegistrations().some(
    (entry) =>
      entry.campaignId === campaignId && entry.nullifier === nullifier,
  );
}

export async function saveCampaignRegistration(
  registration: PartnerRegistration,
): Promise<PartnerRegistration> {
  const redis = getRedis();
  if (redis) {
    const field = registrationField(
      registration.campaignId,
      registration.nullifier,
    );
    if ((await redis.hexists(KV_KEYS.registrations, field)) === 1) {
      throw new Error(
        "This passport has already been registered for this campaign.",
      );
    }
    await redis.hset(KV_KEYS.registrations, { [field]: registration });
    return registration;
  }

  const registrations = readRegistrations();

  if (
    registrations.some(
      (entry) =>
        entry.campaignId === registration.campaignId &&
        entry.nullifier === registration.nullifier,
    )
  ) {
    throw new Error("This passport has already been registered for this campaign.");
  }

  registrations.push(registration);
  writeRegistrations(registrations);
  return registration;
}

export async function getCampaignRegistration(
  campaignId: string,
  nullifier: string,
): Promise<PartnerRegistration | null> {
  const redis = getRedis();
  if (redis) {
    return (
      (await redis.hget<PartnerRegistration>(
        KV_KEYS.registrations,
        registrationField(campaignId, nullifier),
      )) ?? null
    );
  }

  return (
    readRegistrations().find(
      (entry) =>
        entry.campaignId === campaignId && entry.nullifier === nullifier,
    ) ?? null
  );
}

export async function rotateCampaignRegistration(
  registration: PartnerRegistration,
): Promise<PartnerRegistration> {
  const redis = getRedis();
  if (redis) {
    const field = registrationField(
      registration.campaignId,
      registration.nullifier,
    );
    if ((await redis.hexists(KV_KEYS.registrations, field)) !== 1) {
      throw new Error(
        "No claim wallet is registered for this passport and campaign.",
      );
    }
    const updated: PartnerRegistration = {
      ...registration,
      registeredAt: new Date().toISOString(),
    };
    await redis.hset(KV_KEYS.registrations, { [field]: updated });
    return updated;
  }

  const registrations = readRegistrations();
  const index = registrations.findIndex(
    (entry) =>
      entry.campaignId === registration.campaignId &&
      entry.nullifier === registration.nullifier,
  );

  if (index < 0) {
    throw new Error("No claim wallet is registered for this passport and campaign.");
  }

  registrations[index] = {
    ...registration,
    registeredAt: new Date().toISOString(),
  };
  writeRegistrations(registrations);
  return registrations[index];
}

export async function listCampaignRegistrations(
  campaignId: string,
): Promise<PartnerRegistration[]> {
  const redis = getRedis();
  if (redis) {
    const all =
      (await redis.hgetall<Record<string, PartnerRegistration>>(
        KV_KEYS.registrations,
      )) ?? {};
    return Object.values(all).filter(
      (entry) => entry.campaignId === campaignId,
    );
  }

  return readRegistrations().filter(
    (entry) => entry.campaignId === campaignId,
  );
}
