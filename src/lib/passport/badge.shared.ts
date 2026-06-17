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
 * Compact metadata JSON used for the on-chain `data:` URI fallback. The SVG
 * image is intentionally OMITTED here: embedding it would push the badge's
 * `create` transaction past Solana's 1232-byte limit. The tier facts also live
 * in the on-chain Attributes plugin, and the hosted route serves the full image.
 */
function buildOnchainMetadataJson(input: BadgeMetadataInput): string {
  const tierLabel = input.tierLabel || TIER_LABELS[input.tier];

  return JSON.stringify({
    name: `Medusa Passport — ${tierLabel}`,
    symbol: "MEDUSA",
    description:
      "Soulbound proof of a cleared Medusa Privacy Passport tier. Non-transferable.",
    attributes: [
      { trait_type: "Tier", value: tierLabel },
      { trait_type: "Expires", value: input.expiresAt },
      { trait_type: "Soulbound", value: "true" },
    ],
  });
}

function encodeBase64(value: string): string {
  return typeof Buffer !== "undefined"
    ? Buffer.from(value, "utf8").toString("base64")
    : btoa(unescape(encodeURIComponent(value)));
}

/**
 * Builds the short on-chain `uri` for a badge. The `uri` is written inside the
 * mint transaction, so it must stay small (Solana caps transactions at 1232
 * bytes) — a full image-bearing data URI does NOT fit.
 *
 * - Default: a short hosted URL (`/api/passport/badge/metadata`) when a public
 *   app URL is configured. Keeps the mint tx tiny and serves the image with no
 *   bucket required.
 * - Fallback / `MEDUSA_BADGE_METADATA_ONCHAIN=true`: a compact, image-less
 *   `data:` URI so the metadata is fully on-chain (no server dependency).
 */
export function buildBadgeMetadataUri(input: BadgeMetadataInput): string {
  const forceOnchain =
    typeof process !== "undefined" &&
    process.env?.MEDUSA_BADGE_METADATA_ONCHAIN === "true";
  const base = getAppBaseUrl();
  const hostable =
    Boolean(base) &&
    !base.includes("localhost") &&
    !base.includes("127.0.0.1");

  if (!forceOnchain && hostable) {
    const params = new URLSearchParams({
      tier: String(input.tier),
      exp: input.expiresAt,
      policy: input.policyVersion,
      id: input.nullifier,
    });
    return `${base}/api/passport/badge/metadata?${params.toString()}`;
  }

  return `data:application/json;base64,${encodeBase64(buildOnchainMetadataJson(input))}`;
}
