import { getAppBaseUrl, TIER_LABELS, type PassportTier } from "./config";

export interface BadgeMetadataInput {
  tier: PassportTier;
  tierLabel: string;
  policyVersion: string;
  expiresAt: string;
  nullifier: string;
}

export interface BadgeMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{ trait_type: string; value: string }>;
  properties: {
    category: string;
    soulbound: boolean;
  };
}

const TIER_COLORS: Record<PassportTier, string> = {
  1: "#cd7f32",
  2: "#c0c0c0",
  3: "#ffd700",
};

function shortNullifier(nullifier: string): string {
  if (nullifier.length <= 14) {
    return nullifier;
  }
  return `${nullifier.slice(0, 8)}…${nullifier.slice(-4)}`;
}

/**
 * Renders a self-contained SVG for the badge. Kept dependency-free so it can be
 * used both in the metadata route and as a data-URI fallback.
 */
export function buildBadgeImageSvg(input: BadgeMetadataInput): string {
  const accent = TIER_COLORS[input.tier] ?? "#ffffff";
  const id = shortNullifier(input.nullifier);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0a"/>
  <rect x="16" y="16" width="480" height="480" fill="none" stroke="${accent}" stroke-width="2"/>
  <text x="40" y="80" fill="#ffffff" font-family="monospace" font-size="28" letter-spacing="2">// MEDUSA</text>
  <text x="40" y="116" fill="#888888" font-family="monospace" font-size="16">PRIVACY PASSPORT</text>
  <text x="256" y="290" fill="${accent}" font-family="monospace" font-size="64" font-weight="bold" text-anchor="middle">${input.tierLabel}</text>
  <text x="256" y="330" fill="#bbbbbb" font-family="monospace" font-size="18" text-anchor="middle">SOULBOUND · NON-TRANSFERABLE</text>
  <text x="40" y="452" fill="#666666" font-family="monospace" font-size="14">ID ${id}</text>
  <text x="40" y="476" fill="#666666" font-family="monospace" font-size="14">EXP ${input.expiresAt.slice(0, 10)}</text>
</svg>`;
}

export function buildBadgeImageDataUri(input: BadgeMetadataInput): string {
  const svg = buildBadgeImageSvg(input);
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

export function buildBadgeMetadata(input: BadgeMetadataInput): BadgeMetadata {
  const tierLabel = input.tierLabel || TIER_LABELS[input.tier];

  return {
    name: `Medusa Passport — ${tierLabel}`,
    symbol: "MEDUSA",
    description:
      "Soulbound proof that the holder cleared a Medusa Privacy Passport tier. " +
      "Non-transferable. The on-chain attributes mirror the signed Medusa passport " +
      "credential and never reveal the proving wallet or its history.",
    image: buildBadgeImageDataUri({ ...input, tierLabel }),
    external_url: getAppBaseUrl() || "https://zkmedusa.com",
    attributes: [
      { trait_type: "Tier", value: tierLabel },
      { trait_type: "Tier Level", value: String(input.tier) },
      { trait_type: "Policy", value: input.policyVersion },
      { trait_type: "Expires", value: input.expiresAt },
      { trait_type: "Soulbound", value: "true" },
    ],
    properties: {
      category: "image",
      soulbound: true,
    },
  };
}

/**
 * Builds the on-chain `uri` for a badge as a fully self-contained `data:` URI.
 * The entire metadata JSON — including the SVG image — is embedded so the badge
 * lives 100% on-chain and never depends on Medusa's servers being online.
 *
 * Set `MEDUSA_BADGE_METADATA_HOSTED=true` to instead point the `uri` at the
 * hosted `/api/passport/badge/metadata` endpoint (smaller account / lower rent).
 */
export function buildBadgeMetadataUri(input: BadgeMetadataInput): string {
  const hosted =
    typeof process !== "undefined" &&
    process.env?.MEDUSA_BADGE_METADATA_HOSTED === "true";
  const base = getAppBaseUrl();

  if (hosted && base) {
    const params = new URLSearchParams({
      tier: String(input.tier),
      exp: input.expiresAt,
      policy: input.policyVersion,
      id: input.nullifier,
    });
    return `${base}/api/passport/badge/metadata?${params.toString()}`;
  }

  const json = JSON.stringify(buildBadgeMetadata(input));
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${encoded}`;
}
