export function hexToBytes(hex) {
    const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (normalized.length % 2 !== 0) {
        throw new Error("Invalid hex string.");
    }
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}
export function isValidSolanaAddress(address) {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
