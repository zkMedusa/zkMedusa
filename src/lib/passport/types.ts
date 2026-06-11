import type { PassportTier } from "./config";

export interface WalletWitness {
  firstTxTimestamp: number;
  transactionCount: number;
  volumeLamports: number;
  fetchedAt: number;
}

export interface PassportPublicInputs {
  current_timestamp: number;
  min_age_seconds: number;
  min_tx_count: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
}

export interface ZkProofBundle {
  proofType: "noir_ultrahonk" | "dev_local";
  proof: string;
  publicInputs: string[];
}

export interface PassportStatement {
  policyVersion: string;
  tier: PassportTier;
  tierLabel: string;
  minWalletAgeDays: number;
  minTransactionCount: number;
  publicInputs: PassportPublicInputs;
}

export interface MedusaPassport {
  type: "medusa_passport_v1";
  chain: "solana";
  statement: PassportStatement;
  nullifier: string;
  zkProof: ZkProofBundle;
  issuedAt: string;
  expiresAt: string;
  issuer: "medusa";
  signature: string;
}

export interface EligibilityResult {
  eligible: boolean;
  tier: PassportTier | null;
  tierLabel: string | null;
  reasons: string[];
  witness: WalletWitness;
}

export interface IssuePassportRequest {
  zkProof: ZkProofBundle;
  nullifier: string;
  tier: PassportTier;
  publicInputs: PassportPublicInputs;
}

export interface VerifyPassportResponse {
  valid: boolean;
  passport?: MedusaPassport;
  error?: string;
}
