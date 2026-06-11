import nacl from "tweetnacl";
import {
  PASSPORT_POLICY_VERSION,
  TIER_LABELS,
  type MedusaPassport,
  type VerifyPassportOptions,
  type VerifyPassportResult,
} from "./types.js";
import { hexToBytes } from "./utils.js";

function isPassportShape(value: unknown): value is MedusaPassport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const passport = value as MedusaPassport;
  return (
    passport.type === "medusa_passport_v1" &&
    passport.chain === "solana" &&
    passport.issuer === "medusa" &&
    typeof passport.signature === "string" &&
    typeof passport.nullifier === "string" &&
    typeof passport.expiresAt === "string" &&
    typeof passport.statement?.tier === "number"
  );
}

export function parsePassportJson(input: string): MedusaPassport {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Passport JSON is invalid.");
  }

  if (!isPassportShape(parsed)) {
    throw new Error("Passport structure is invalid.");
  }

  return parsed;
}

export function verifyPassportSignature(
  passport: MedusaPassport,
  issuerPublicKey: string,
): boolean {
  const { signature, ...payload } = passport;
  const message = new TextEncoder().encode(JSON.stringify(payload));

  return nacl.sign.detached.verify(
    message,
    hexToBytes(signature),
    hexToBytes(issuerPublicKey),
  );
}

export function verifyPassport(
  passport: MedusaPassport,
  options: VerifyPassportOptions = {},
): VerifyPassportResult {
  const errors: string[] = [];
  const policyVersion = options.policyVersion ?? PASSPORT_POLICY_VERSION;
  const now = options.now ?? new Date();

  if (passport.type !== "medusa_passport_v1") {
    errors.push("Unsupported passport type.");
  }

  if (passport.statement.policyVersion !== policyVersion) {
    errors.push("Passport policy version mismatch.");
  }

  if (new Date(passport.expiresAt).getTime() < now.getTime()) {
    errors.push("Passport has expired.");
  }

  if (options.minTier && passport.statement.tier < options.minTier) {
    errors.push(
      `Passport tier ${passport.statement.tier} is below required tier ${options.minTier}.`,
    );
  }

  if (options.issuerPublicKey) {
    const signatureValid = verifyPassportSignature(
      passport,
      options.issuerPublicKey,
    );

    if (!signatureValid) {
      errors.push("Passport signature is invalid.");
    }
  } else {
    errors.push("issuerPublicKey is required for local verification.");
  }

  const valid = errors.length === 0;

  return {
    valid,
    tier: passport.statement.tier,
    tierLabel: TIER_LABELS[passport.statement.tier],
    nullifier: passport.nullifier,
    expiresAt: passport.expiresAt,
    errors,
  };
}
