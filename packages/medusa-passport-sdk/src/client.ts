import { MedusaPassportError } from "./errors.js";
import {
  parsePassportJson,
  verifyPassport,
  verifyPassportSignature,
} from "./verify.js";
import type {
  IssuerInfo,
  MedusaPassport,
  PassportPolicy,
  RegisterPassportInput,
  RegisterPassportResult,
  ClaimRegisterInput,
  ClaimRegisterResult,
  ClaimRotateInput,
  ClaimRotateResult,
  VerifyPassportOptions,
  VerifyPassportResult,
  WhitelistEntry,
} from "./types.js";

export interface MedusaPassportClientOptions {
  baseUrl: string;
  apiKey?: string;
  issuerPublicKey?: string;
  fetchImpl?: typeof fetch;
}

export class MedusaPassportClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private issuerPublicKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MedusaPassportClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.issuerPublicKey = options.issuerPublicKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async fetchIssuer(): Promise<IssuerInfo> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/passport/issuer`);

    if (!response.ok) {
      throw new MedusaPassportError(
        "Failed to fetch issuer public key.",
        "API_ERROR",
      );
    }

    const issuer = (await response.json()) as IssuerInfo;
    this.issuerPublicKey = issuer.publicKey;
    return issuer;
  }

  async fetchPolicy(): Promise<PassportPolicy> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/passport/verify`);

    if (!response.ok) {
      throw new MedusaPassportError("Failed to fetch passport policy.", "API_ERROR");
    }

    return response.json() as Promise<PassportPolicy>;
  }

  async verifyRemote(passport: MedusaPassport): Promise<VerifyPassportResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/passport/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passport),
    });

    const payload = (await response.json()) as {
      valid: boolean;
      tierLabel?: string;
      passport?: MedusaPassport;
      error?: string;
    };

    if (!response.ok || !payload.valid || !payload.passport) {
      return {
        valid: false,
        errors: [payload.error ?? "Remote verification failed."],
      };
    }

    return {
      valid: true,
      tier: payload.passport.statement.tier,
      tierLabel: payload.tierLabel,
      nullifier: payload.passport.nullifier,
      expiresAt: payload.passport.expiresAt,
      errors: [],
    };
  }

  async verify(
    passport: MedusaPassport,
    options: Omit<VerifyPassportOptions, "issuerPublicKey"> = {},
  ): Promise<VerifyPassportResult> {
    if (!this.issuerPublicKey) {
      try {
        await this.fetchIssuer();
      } catch {
        return this.verifyRemote(passport);
      }
    }

    return verifyPassport(passport, {
      ...options,
      issuerPublicKey: this.issuerPublicKey,
    });
  }

  verifyLocal(
    passport: MedusaPassport,
    options: VerifyPassportOptions,
  ): VerifyPassportResult {
    return verifyPassport(passport, options);
  }

  async parseAndVerify(
    passportJson: string,
    options: Omit<VerifyPassportOptions, "issuerPublicKey"> = {},
  ): Promise<VerifyPassportResult> {
    const passport = parsePassportJson(passportJson);

    if (!this.issuerPublicKey) {
      await this.fetchIssuer().catch(() => undefined);
    }

    if (this.issuerPublicKey) {
      return verifyPassport(passport, {
        ...options,
        issuerPublicKey: this.issuerPublicKey,
      });
    }

    return this.verifyRemote(passport);
  }

  async register(input: RegisterPassportInput): Promise<RegisterPassportResult> {
    if (!this.apiKey) {
      throw new MedusaPassportError(
        "apiKey is required to register passports.",
        "REGISTRATION_FAILED",
      );
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/partner/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as RegisterPassportResult & {
      error?: string;
    };

    if (!response.ok || !payload.registered) {
      throw new MedusaPassportError(
        payload.error ?? "Passport registration failed.",
        "REGISTRATION_FAILED",
      );
    }

    return payload;
  }

  async registerClaimWallet(
    input: ClaimRegisterInput,
  ): Promise<ClaimRegisterResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/passport/claim/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );

    const payload = (await response.json()) as ClaimRegisterResult & {
      error?: string;
    };

    if (!response.ok || !payload.registered) {
      throw new MedusaPassportError(
        payload.error ?? "Claim wallet registration failed.",
        "REGISTRATION_FAILED",
      );
    }

    return payload;
  }

  async rotateClaimWallet(input: ClaimRotateInput): Promise<ClaimRotateResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/passport/claim/rotate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );

    const payload = (await response.json()) as ClaimRotateResult & {
      error?: string;
    };

    if (!response.ok || !payload.rotated) {
      throw new MedusaPassportError(
        payload.error ?? "Claim wallet rotation failed.",
        "REGISTRATION_FAILED",
      );
    }

    return payload;
  }

  async getWhitelist(campaignId: string): Promise<WhitelistEntry[]> {
    if (!this.apiKey) {
      throw new MedusaPassportError(
        "apiKey is required to fetch whitelist entries.",
        "API_ERROR",
      );
    }

    const response = await this.fetchImpl(
      `${this.baseUrl}/api/partner/whitelist?campaignId=${encodeURIComponent(campaignId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    const payload = (await response.json()) as {
      entries?: WhitelistEntry[];
      error?: string;
    };

    if (!response.ok) {
      throw new MedusaPassportError(
        payload.error ?? "Failed to fetch whitelist.",
        "API_ERROR",
      );
    }

    return payload.entries ?? [];
  }

  hasValidSignature(passport: MedusaPassport, issuerPublicKey?: string): boolean {
    const key = issuerPublicKey ?? this.issuerPublicKey;
    if (!key) {
      return false;
    }

    return verifyPassportSignature(passport, key);
  }
}
