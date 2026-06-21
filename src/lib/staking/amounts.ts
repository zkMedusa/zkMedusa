import BN from "bn.js";

const DEFAULT_MEDUSA_DECIMALS = 6;

export function getDefaultMedusaDecimals(): number {
  return DEFAULT_MEDUSA_DECIMALS;
}

/** Raw on-chain units → decimal string (e.g. 1000000 → "1"). */
export function rawToMedusaAmount(
  raw: BN | bigint | number | string,
  decimals = DEFAULT_MEDUSA_DECIMALS,
): string {
  const value =
    raw instanceof BN ? BigInt(raw.toString()) : BigInt(String(raw));
  if (value === BigInt(0)) {
    return "0";
  }

  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

/** User-entered decimal string → raw BN. */
export function medusaAmountToRaw(
  amount: string,
  decimals = DEFAULT_MEDUSA_DECIMALS,
): BN {
  const trimmed = amount.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid $MEDUSA amount.");
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal places.`);
  }

  const paddedFraction = fractionPart.padEnd(decimals, "0");
  const raw = BigInt(wholePart + paddedFraction);
  if (raw <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  return new BN(raw.toString());
}

export function sumMedusaAmounts(values: string[]): string {
  const total = values.reduce(
    (acc, value) => acc + Number.parseFloat(value || "0"),
    0,
  );
  if (!Number.isFinite(total) || total === 0) {
    return "0";
  }
  return total.toString();
}
