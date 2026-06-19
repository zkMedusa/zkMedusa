interface PartnerKey {
  campaignId: string;
  apiKey: string;
}

function loadPartnerKeys(): PartnerKey[] {
  const raw = process.env.MEDUSA_PARTNER_API_KEYS;
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex <= 0) {
        return null;
      }

      return {
        campaignId: entry.slice(0, separatorIndex).trim(),
        apiKey: entry.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((entry): entry is PartnerKey => entry !== null);
}

export function getAuthorizedCampaignId(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const apiKey = authorizationHeader.slice("Bearer ".length).trim();
  const partner = loadPartnerKeys().find((entry) => entry.apiKey === apiKey);
  return partner?.campaignId ?? null;
}

/** Same key map as campaigns — token partners use their partner id (e.g. deepbot). */
export function getAuthorizedPartnerId(
  authorizationHeader: string | null,
): string | null {
  return getAuthorizedCampaignId(authorizationHeader);
}

export function isPartnerAuthConfigured(): boolean {
  return loadPartnerKeys().length > 0;
}
