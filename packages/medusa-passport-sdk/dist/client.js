import { MedusaPassportError } from "./errors.js";
import { fetchPassportBadges, hasPassportBadge, } from "./badges.js";
import { parsePassportJson, verifyPassport, verifyPassportSignature, } from "./verify.js";
export class MedusaPassportClient {
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.issuerPublicKey = options.issuerPublicKey;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async fetchIssuer() {
        const response = await this.fetchImpl(`${this.baseUrl}/api/passport/issuer`);
        if (!response.ok) {
            throw new MedusaPassportError("Failed to fetch issuer public key.", "API_ERROR");
        }
        const issuer = (await response.json());
        this.issuerPublicKey = issuer.publicKey;
        return issuer;
    }
    async fetchPolicy() {
        const response = await this.fetchImpl(`${this.baseUrl}/api/passport/verify`);
        if (!response.ok) {
            throw new MedusaPassportError("Failed to fetch passport policy.", "API_ERROR");
        }
        return response.json();
    }
    async verifyRemote(passport) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/passport/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(passport),
        });
        const payload = (await response.json());
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
    async verify(passport, options = {}) {
        if (!this.issuerPublicKey) {
            try {
                await this.fetchIssuer();
            }
            catch {
                return this.verifyRemote(passport);
            }
        }
        return verifyPassport(passport, {
            ...options,
            issuerPublicKey: this.issuerPublicKey,
        });
    }
    verifyLocal(passport, options) {
        return verifyPassport(passport, options);
    }
    async parseAndVerify(passportJson, options = {}) {
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
    async register(input) {
        if (!this.apiKey) {
            throw new MedusaPassportError("apiKey is required to register passports.", "REGISTRATION_FAILED");
        }
        const response = await this.fetchImpl(`${this.baseUrl}/api/partner/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(input),
        });
        const payload = (await response.json());
        if (!response.ok || !payload.registered) {
            throw new MedusaPassportError(payload.error ?? "Passport registration failed.", "REGISTRATION_FAILED");
        }
        return payload;
    }
    async registerClaimWallet(input) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/passport/claim/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        const payload = (await response.json());
        if (!response.ok || !payload.registered) {
            throw new MedusaPassportError(payload.error ?? "Claim wallet registration failed.", "REGISTRATION_FAILED");
        }
        return payload;
    }
    async rotateClaimWallet(input) {
        const response = await this.fetchImpl(`${this.baseUrl}/api/passport/claim/rotate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        });
        const payload = (await response.json());
        if (!response.ok || !payload.rotated) {
            throw new MedusaPassportError(payload.error ?? "Claim wallet rotation failed.", "REGISTRATION_FAILED");
        }
        return payload;
    }
    async getWhitelist(campaignId) {
        if (!this.apiKey) {
            throw new MedusaPassportError("apiKey is required to fetch whitelist entries.", "API_ERROR");
        }
        const response = await this.fetchImpl(`${this.baseUrl}/api/partner/whitelist?campaignId=${encodeURIComponent(campaignId)}`, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
            },
        });
        const payload = (await response.json());
        if (!response.ok) {
            throw new MedusaPassportError(payload.error ?? "Failed to fetch whitelist.", "API_ERROR");
        }
        return payload.entries ?? [];
    }
    async getBadges(owner, options) {
        return fetchPassportBadges(owner, {
            fetchImpl: this.fetchImpl,
            ...options,
        });
    }
    async hasBadge(owner, options) {
        return hasPassportBadge(owner, {
            fetchImpl: this.fetchImpl,
            ...options,
        });
    }
    hasValidSignature(passport, issuerPublicKey) {
        const key = issuerPublicKey ?? this.issuerPublicKey;
        if (!key) {
            return false;
        }
        return verifyPassportSignature(passport, key);
    }
}
