export declare const PASSPORT_POLICY_VERSION: "medusa-passport-v1";
export declare const PASSPORT_TIERS: {
    readonly BRONZE: 1;
    readonly SILVER: 2;
    readonly GOLD: 3;
};
export type PassportTier = (typeof PASSPORT_TIERS)[keyof typeof PASSPORT_TIERS];
export declare const TIER_LABELS: Record<PassportTier, string>;
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
export interface VerifyPassportOptions {
    issuerPublicKey?: string;
    minTier?: PassportTier;
    policyVersion?: string;
    now?: Date;
}
export interface VerifyPassportResult {
    valid: boolean;
    tier?: PassportTier;
    tierLabel?: string;
    nullifier?: string;
    expiresAt?: string;
    errors: string[];
}
export interface RegisterPassportInput {
    passport: MedusaPassport;
    claimWallet: string;
    campaignId: string;
}
export interface RegisterPassportResult {
    registered: boolean;
    campaignId: string;
    claimWallet: string;
    tier: PassportTier;
    tierLabel: string;
    nullifier: string;
    registeredAt: string;
}
export interface ClaimRegisterInput {
    passport: MedusaPassport;
    claimWallet: string;
    campaignId?: string;
}
export interface ClaimRegisterResult {
    registered: boolean;
    campaignId: string;
    claimWallet: string;
    tier: PassportTier;
    tierLabel: string;
    nullifier: string;
    registeredAt: string;
}
export interface ClaimRotateInput {
    passport: MedusaPassport;
    claimWallet: string;
    campaignId?: string;
}
export interface ClaimRotateResult {
    rotated: boolean;
    previousClaimWallet: string;
    campaignId: string;
    claimWallet: string;
    tier: PassportTier;
    tierLabel: string;
    nullifier: string;
    registeredAt: string;
}
export interface WhitelistEntry {
    campaignId: string;
    claimWallet: string;
    tier: PassportTier;
    tierLabel: string;
    nullifier: string;
    registeredAt: string;
}
export interface PassportPolicy {
    policyVersion: string;
    requirements: Record<string, unknown>;
    validityDays: number;
    issuePriceLamports: number;
    devMode: boolean;
}
export interface IssuerInfo {
    issuer: "medusa";
    publicKey: string;
    policyVersion: string;
}
//# sourceMappingURL=types.d.ts.map