import { type FetchPassportBadgesOptions, type PassportBadge } from "./badges.js";
import type { IssuerInfo, MedusaPassport, PassportPolicy, RegisterPassportInput, RegisterPassportResult, ClaimRegisterInput, ClaimRegisterResult, ClaimRotateInput, ClaimRotateResult, VerifyPassportOptions, VerifyPassportResult, WhitelistEntry } from "./types.js";
export interface MedusaPassportClientOptions {
    baseUrl: string;
    apiKey?: string;
    issuerPublicKey?: string;
    fetchImpl?: typeof fetch;
}
export declare class MedusaPassportClient {
    private readonly baseUrl;
    private readonly apiKey?;
    private issuerPublicKey?;
    private readonly fetchImpl;
    constructor(options: MedusaPassportClientOptions);
    fetchIssuer(): Promise<IssuerInfo>;
    fetchPolicy(): Promise<PassportPolicy>;
    verifyRemote(passport: MedusaPassport): Promise<VerifyPassportResult>;
    verify(passport: MedusaPassport, options?: Omit<VerifyPassportOptions, "issuerPublicKey">): Promise<VerifyPassportResult>;
    verifyLocal(passport: MedusaPassport, options: VerifyPassportOptions): VerifyPassportResult;
    parseAndVerify(passportJson: string, options?: Omit<VerifyPassportOptions, "issuerPublicKey">): Promise<VerifyPassportResult>;
    register(input: RegisterPassportInput): Promise<RegisterPassportResult>;
    registerClaimWallet(input: ClaimRegisterInput): Promise<ClaimRegisterResult>;
    rotateClaimWallet(input: ClaimRotateInput): Promise<ClaimRotateResult>;
    getWhitelist(campaignId: string): Promise<WhitelistEntry[]>;
    getBadges(owner: string, options: FetchPassportBadgesOptions): Promise<PassportBadge[]>;
    hasBadge(owner: string, options: FetchPassportBadgesOptions): Promise<boolean>;
    hasValidSignature(passport: MedusaPassport, issuerPublicKey?: string): boolean;
}
//# sourceMappingURL=client.d.ts.map