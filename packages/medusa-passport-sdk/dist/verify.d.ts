import { type MedusaPassport, type VerifyPassportOptions, type VerifyPassportResult } from "./types.js";
export declare function parsePassportJson(input: string): MedusaPassport;
export declare function verifyPassportSignature(passport: MedusaPassport, issuerPublicKey: string): boolean;
export declare function verifyPassport(passport: MedusaPassport, options?: VerifyPassportOptions): VerifyPassportResult;
//# sourceMappingURL=verify.d.ts.map