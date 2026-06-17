import { type PassportTier } from "./types.js";
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
/**
 * Reads the soulbound Medusa passport badges (MPL Core assets) owned by a
 * wallet using the DAS API. Use this to gate access by on-chain badge instead
 * of (or in addition to) verifying a signed passport credential.
 *
 * Note: the authoritative tier is always the signed passport; on-chain
 * attributes are a convenience mirror that depends on your DAS provider
 * exposing MPL Core attributes.
 */
export declare function fetchPassportBadges(owner: string, options: FetchPassportBadgesOptions): Promise<PassportBadge[]>;
/**
 * Convenience predicate: returns true when the wallet holds at least one
 * soulbound Medusa passport badge meeting the supplied options.
 */
export declare function hasPassportBadge(owner: string, options: FetchPassportBadgesOptions): Promise<boolean>;
//# sourceMappingURL=badges.d.ts.map