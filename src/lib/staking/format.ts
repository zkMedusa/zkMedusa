/** Formats a whole-token amount for display (supports K / M suffixes). */
export function formatMedusaAmount(raw: string | number): string {
  const value = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString();
}
