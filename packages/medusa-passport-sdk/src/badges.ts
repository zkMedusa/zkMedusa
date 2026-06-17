import { MedusaPassportError } from "./errors.js";
import { PASSPORT_TIERS, TIER_LABELS, type PassportTier } from "./types.js";

export interface PassportBadge {
  /** MPL Core asset address of the soulbound badge. */
  assetId: string;
  owner: string;
  collection: string | null;
  /** True when the asset is permanently frozen (soulbound). */
  frozen: boolean;
  name?: string;
  tier?: PassportTier;
  tierLabel?: string;
  expiresAt?: string;
  nullifier?: string;
  /** Raw DAS asset object for advanced consumers. */
  raw: unknown;
}

export interface FetchPassportBadgesOptions {
  /**
   * A Solana RPC endpoint that supports the DAS (Digital Asset Standard) API,
   * e.g. Helius/Triton/QuickNode. Required to read MPL Core assets by owner.
   */
  dasRpcUrl: string;
  /** Only return badges that belong to this collection address. */
  collection?: string;
  /** Only return badges at or above this tier. */
  minTier?: PassportTier;
  /** Only return permanently-frozen (soulbound) badges. Defaults to true. */
  requireFrozen?: boolean;
  fetchImpl?: typeof fetch;
}

const TIER_FROM_LABEL: Record<string, PassportTier> = {
  [TIER_LABELS[PASSPORT_TIERS.BRONZE]]: PASSPORT_TIERS.BRONZE,
  [TIER_LABELS[PASSPORT_TIERS.SILVER]]: PASSPORT_TIERS.SILVER,
  [TIER_LABELS[PASSPORT_TIERS.GOLD]]: PASSPORT_TIERS.GOLD,
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object"
    ? (value as UnknownRecord)
    : undefined;
}

/**
 * MPL Core attributes can surface in a few shapes across DAS providers, so we
 * read defensively from all of them and normalize to a flat key/value map.
 */
function readAttributes(item: UnknownRecord): Record<string, string> {
  const out: Record<string, string> = {};

  const content = asRecord(item.content);
  const metadata = content ? asRecord(content.metadata) : undefined;
  const plugins = asRecord(item.plugins);
  const attributesPlugin = plugins ? asRecord(plugins.attributes) : undefined;
  const attributesPluginData = attributesPlugin
    ? asRecord(attributesPlugin.data)
    : undefined;
  const mplCoreInfo = asRecord(item.mpl_core_info);

  const sources: unknown[] = [
    item.attributes,
    metadata?.attributes,
    attributesPluginData?.attribute_list,
    mplCoreInfo?.attributes,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const entry of source) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }

      const key = record.key ?? record.trait_type;
      const value = record.value;
      if (typeof key === "string" && value != null) {
        out[key.toLowerCase()] = String(value);
      }
    }
  }

  return out;
}

function tierFromAttributes(
  attrs: Record<string, string>,
): PassportTier | undefined {
  const label = attrs.tier?.toUpperCase();
  if (label && label in TIER_FROM_LABEL) {
    return TIER_FROM_LABEL[label];
  }

  const level = Number(attrs.tierlevel);
  if (level === 1 || level === 2 || level === 3) {
    return level;
  }

  return undefined;
}

function collectionFromGrouping(item: UnknownRecord): string | null {
  const grouping = item.grouping;
  if (!Array.isArray(grouping)) {
    return null;
  }

  for (const entry of grouping) {
    const record = asRecord(entry);
    if (record && record.group_key === "collection") {
      return typeof record.group_value === "string"
        ? record.group_value
        : null;
    }
  }

  return null;
}

function isFrozen(item: UnknownRecord): boolean {
  const ownership = asRecord(item.ownership);
  if (ownership && typeof ownership.frozen === "boolean") {
    return ownership.frozen;
  }

  const plugins = asRecord(item.plugins);
  const permanentFreeze = plugins
    ? asRecord(plugins.permanent_freeze_delegate ?? plugins.permanentFreezeDelegate)
    : undefined;
  const data = permanentFreeze ? asRecord(permanentFreeze.data) : undefined;
  return data?.frozen === true;
}

function toBadge(item: UnknownRecord): PassportBadge {
  const attrs = readAttributes(item);
  const content = asRecord(item.content);
  const metadata = content ? asRecord(content.metadata) : undefined;
  const tier = tierFromAttributes(attrs);

  return {
    assetId: typeof item.id === "string" ? item.id : "",
    owner: asRecord(item.ownership)?.owner as string | undefined ?? "",
    collection: collectionFromGrouping(item),
    frozen: isFrozen(item),
    name:
      (metadata?.name as string | undefined) ??
      (typeof item.name === "string" ? item.name : undefined),
    tier,
    tierLabel: tier ? TIER_LABELS[tier] : attrs.tier?.toUpperCase(),
    expiresAt: attrs.expiresat,
    nullifier: attrs.nullifier,
    raw: item,
  };
}

/**
 * Reads the soulbound Medusa passport badges (MPL Core assets) owned by a
 * wallet using the DAS API. Use this to gate access by on-chain badge instead
 * of (or in addition to) verifying a signed passport credential.
 *
 * Note: the authoritative tier is always the signed passport; on-chain
 * attributes are a convenience mirror that depends on your DAS provider
 * exposing MPL Core attributes.
 */
export async function fetchPassportBadges(
  owner: string,
  options: FetchPassportBadgesOptions,
): Promise<PassportBadge[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requireFrozen = options.requireFrozen ?? true;

  const response = await fetchImpl(options.dasRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "medusa-badges",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: owner,
        page: 1,
        limit: 1000,
      },
    }),
  });

  if (!response.ok) {
    throw new MedusaPassportError(
      `DAS request failed with status ${response.status}.`,
      "API_ERROR",
    );
  }

  const payload = (await response.json()) as {
    result?: { items?: unknown[] };
    error?: { message?: string };
  };

  if (payload.error) {
    throw new MedusaPassportError(
      payload.error.message ?? "DAS request returned an error.",
      "API_ERROR",
    );
  }

  const items = payload.result?.items ?? [];

  return items
    .map(asRecord)
    .filter((item): item is UnknownRecord => Boolean(item))
    .filter((item) => {
      const iface = item.interface;
      return iface === undefined || iface === "MplCoreAsset";
    })
    .map(toBadge)
    .filter((badge) => {
      if (options.collection && badge.collection !== options.collection) {
        return false;
      }
      if (requireFrozen && !badge.frozen) {
        return false;
      }
      if (
        options.minTier !== undefined &&
        (badge.tier === undefined || badge.tier < options.minTier)
      ) {
        return false;
      }
      return true;
    });
}

/**
 * Convenience predicate: returns true when the wallet holds at least one
 * soulbound Medusa passport badge meeting the supplied options.
 */
export async function hasPassportBadge(
  owner: string,
  options: FetchPassportBadgesOptions,
): Promise<boolean> {
  const badges = await fetchPassportBadges(owner, options);
  return badges.length > 0;
}
