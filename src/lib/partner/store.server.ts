import fs from "node:fs";
import path from "node:path";
import type { PassportTier } from "@/lib/passport/config";

export interface PartnerRegistration {
  campaignId: string;
  nullifier: string;
  claimWallet: string;
  tier: PassportTier;
  tierLabel: string;
  registeredAt: string;
}

const DATA_DIR = path.join(process.cwd(), ".data");
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

export function hasCampaignRegistration(
  campaignId: string,
  nullifier: string,
): boolean {
  return readRegistrations().some(
    (entry) =>
      entry.campaignId === campaignId && entry.nullifier === nullifier,
  );
}

export function saveCampaignRegistration(
  registration: PartnerRegistration,
): PartnerRegistration {
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

export function listCampaignRegistrations(
  campaignId: string,
): PartnerRegistration[] {
  return readRegistrations().filter(
    (entry) => entry.campaignId === campaignId,
  );
}
