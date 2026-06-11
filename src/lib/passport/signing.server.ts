import { createHash } from "node:crypto";
import nacl from "tweetnacl";
import {
  bytesToHex,
  canonicalizePublicInputs,
  hexToBytes,
} from "./eligibility";
import type { MedusaPassport } from "./types";

function getIssuerSecretKey(): Uint8Array {
  const secret = process.env.PASSPORT_ISSUER_SECRET_KEY;
  if (!secret) {
    throw new Error("PASSPORT_ISSUER_SECRET_KEY is not configured.");
  }

  return hexToBytes(secret);
}

export function getIssuerPublicKeyHex(): string {
  const publicKey = process.env.PASSPORT_ISSUER_PUBLIC_KEY;
  if (publicKey) {
    return publicKey;
  }

  const secretKey = getIssuerSecretKey();
  return bytesToHex(nacl.sign.keyPair.fromSecretKey(secretKey).publicKey);
}

export function generateIssuerKeyPair(): {
  publicKey: string;
  secretKey: string;
} {
  const keyPair = nacl.sign.keyPair();
  return {
    publicKey: bytesToHex(keyPair.publicKey),
    secretKey: bytesToHex(keyPair.secretKey),
  };
}

export function signPassportPayload(
  payload: Omit<MedusaPassport, "signature">,
): string {
  const secretKey = getIssuerSecretKey();
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const signature = nacl.sign.detached(message, secretKey);
  return bytesToHex(signature);
}

export function verifyPassportSignature(passport: MedusaPassport): boolean {
  const { signature, ...payload } = passport;
  const message = new TextEncoder().encode(JSON.stringify(payload));
  return nacl.sign.detached.verify(
    message,
    hexToBytes(signature),
    hexToBytes(getIssuerPublicKeyHex()),
  );
}

export function hashPublicInputsServer(
  publicInputs: Record<string, number>,
): string {
  return createHash("sha256")
    .update(canonicalizePublicInputs(publicInputs))
    .digest("hex");
}
