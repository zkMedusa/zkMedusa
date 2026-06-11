import type { IssuerInfo, MedusaPassport, PassportPolicy, RegisterPassportInput, RegisterPassportResult, VerifyPassportOptions, VerifyPassportResult, WhitelistEntry } from "./types.js";
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
    getWhitelist(campaignId: string): Promise<WhitelistEntry[]>;
    hasValidSignature(passport: MedusaPassport, issuerPublicKey?: string): boolean;
}
//# sourceMappingURL=client.d.ts.map