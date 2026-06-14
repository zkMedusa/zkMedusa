"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const STORAGE_KEY = "medusa-claim-wallets-v1";
const PASSPORT_SESSION_KEY = "medusa-passport-active";

export interface ClaimWalletRecord {
  id: string;
  publicKey: string;
  secretKeyBase58: string;
  passportNullifier: string;
  label: string;
  createdAt: string;
  registrations: Array<{
    campaignId: string;
    registeredAt: string;
  }>;
}

export interface GeneratedClaimWallet {
  publicKey: string;
  secretKeyBase58: string;
  keypair: Keypair;
}

export interface ClaimWalletBackup {
  type: "medusa_claim_wallet_v1";
  publicKey: string;
  secretKeyBase58: string;
  passportNullifier: string;
  label?: string;
  createdAt?: string;
}

export function generateClaimWalletKeypair(): GeneratedClaimWallet {
  const keypair = Keypair.generate();

  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKeyBase58: bs58.encode(keypair.secretKey),
    keypair,
  };
}

function readStore(): ClaimWalletRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as ClaimWalletRecord[];
  } catch {
    return [];
  }
}

function writeStore(records: ClaimWalletRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listClaimWallets(passportNullifier?: string): ClaimWalletRecord[] {
  const records = readStore();

  if (!passportNullifier) {
    return records;
  }

  return records.filter(
    (record) => record.passportNullifier === passportNullifier,
  );
}

export function saveClaimWallet(
  passportNullifier: string,
  wallet: GeneratedClaimWallet,
  label?: string,
): ClaimWalletRecord {
  const records = readStore();
  const record: ClaimWalletRecord = {
    id: crypto.randomUUID(),
    publicKey: wallet.publicKey,
    secretKeyBase58: wallet.secretKeyBase58,
    passportNullifier,
    label: label ?? `Claim ${records.filter((entry) => entry.passportNullifier === passportNullifier).length + 1}`,
    createdAt: new Date().toISOString(),
    registrations: [],
  };

  records.unshift(record);
  writeStore(records);
  return record;
}

export function markClaimWalletRegistered(
  walletId: string,
  campaignId: string,
): ClaimWalletRecord | null {
  const records = readStore();
  const index = records.findIndex((record) => record.id === walletId);

  if (index < 0) {
    return null;
  }

  const existing = records[index].registrations.filter(
    (entry) => entry.campaignId !== campaignId,
  );

  records[index] = {
    ...records[index],
    registrations: [
      ...existing,
      { campaignId, registeredAt: new Date().toISOString() },
    ],
  };

  writeStore(records);
  return records[index];
}

export function exportClaimWalletJson(record: ClaimWalletRecord): string {
  return JSON.stringify(
    {
      type: "medusa_claim_wallet_v1",
      publicKey: record.publicKey,
      secretKeyBase58: record.secretKeyBase58,
      passportNullifier: record.passportNullifier,
      label: record.label,
      createdAt: record.createdAt,
    },
    null,
    2,
  );
}

export function downloadClaimWalletBackup(record: ClaimWalletRecord): void {
  const blob = new Blob([exportClaimWalletJson(record)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `medusa-claim-${record.publicKey.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseClaimWalletBackup(raw: string): ClaimWalletBackup {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Claim wallet backup JSON is invalid.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Claim wallet backup structure is invalid.");
  }

  const backup = parsed as Partial<ClaimWalletBackup>;

  if (backup.type !== "medusa_claim_wallet_v1") {
    throw new Error('Expected backup type "medusa_claim_wallet_v1".');
  }

  if (
    !backup.publicKey ||
    !backup.secretKeyBase58 ||
    !backup.passportNullifier
  ) {
    throw new Error("Backup is missing publicKey, secretKeyBase58, or passportNullifier.");
  }

  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(backup.secretKeyBase58));
    if (keypair.publicKey.toBase58() !== backup.publicKey) {
      throw new Error("Secret key does not match the public address in this backup.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Secret key")) {
      throw error;
    }
    throw new Error("Secret key in backup is invalid.");
  }

  return {
    type: "medusa_claim_wallet_v1",
    publicKey: backup.publicKey,
    secretKeyBase58: backup.secretKeyBase58,
    passportNullifier: backup.passportNullifier,
    label: backup.label,
    createdAt: backup.createdAt,
  };
}

export function importClaimWalletBackup(
  backup: ClaimWalletBackup,
  expectedNullifier?: string,
): ClaimWalletRecord {
  if (expectedNullifier && backup.passportNullifier !== expectedNullifier) {
    throw new Error("This backup belongs to a different passport.");
  }

  const records = readStore();
  const existingIndex = records.findIndex(
    (record) => record.publicKey === backup.publicKey,
  );

  if (existingIndex >= 0) {
    return records[existingIndex];
  }

  const record: ClaimWalletRecord = {
    id: crypto.randomUUID(),
    publicKey: backup.publicKey,
    secretKeyBase58: backup.secretKeyBase58,
    passportNullifier: backup.passportNullifier,
    label:
      backup.label ??
      `Claim ${records.filter((entry) => entry.passportNullifier === backup.passportNullifier).length + 1}`,
    createdAt: backup.createdAt ?? new Date().toISOString(),
    registrations: [],
  };

  records.unshift(record);
  writeStore(records);
  return record;
}

export function storePassportForWalletPage(passport: {
  type: string;
  nullifier: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PASSPORT_SESSION_KEY, JSON.stringify(passport));
}

export function loadPassportFromSession(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage.getItem(PASSPORT_SESSION_KEY);
}
