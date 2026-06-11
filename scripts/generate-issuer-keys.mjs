import nacl from "tweetnacl";

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const keyPair = nacl.sign.keyPair();

console.log("Add these to your .env.local file:\n");
console.log(`PASSPORT_ISSUER_SECRET_KEY=${bytesToHex(keyPair.secretKey)}`);
console.log(`PASSPORT_ISSUER_PUBLIC_KEY=${bytesToHex(keyPair.publicKey)}`);
