import type { MedusaPassport } from "./types";

export function formatPassportId(nullifier: string): string {
  return `MDS-${nullifier.slice(0, 8).toUpperCase()}-${nullifier.slice(8, 16).toUpperCase()}`;
}

export function formatPassportDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getTierAccentColor(tierLabel: string): string {
  switch (tierLabel.toUpperCase()) {
    case "GOLD":
      return "#d4af37";
    case "SILVER":
      return "#b8bcc4";
    case "BRONZE":
    default:
      return "#b87333";
  }
}

export function getPassportDownloadFilename(passport: MedusaPassport): string {
  const id = formatPassportId(passport.nullifier);
  return `medusa-passport-${id}.png`;
}
