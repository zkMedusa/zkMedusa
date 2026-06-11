import { ungzip } from "pako";

function decodeBase64Bytecode(base64Bytecode: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64Bytecode, "base64"));
  }

  const binary = atob(base64Bytecode);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** Mirrors @aztec/bb.js acirToUint8Array: base64 then gunzip when gzip-wrapped. */
export function normalizeAcirBytecode(base64Bytecode: string): Uint8Array {
  const compressed = decodeBase64Bytecode(base64Bytecode);

  if (isGzip(compressed)) {
    return ungzip(compressed);
  }

  return compressed;
}

export function normalizeGzipWrappedBytes(bytes: Uint8Array): Uint8Array {
  if (isGzip(bytes)) {
    return ungzip(bytes);
  }

  return bytes;
}
