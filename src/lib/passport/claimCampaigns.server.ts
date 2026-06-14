export function getPublicClaimCampaignIds(): string[] {
  const raw = process.env.MEDUSA_CLAIM_CAMPAIGN_IDS ?? "medusa-claim";

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isPublicClaimCampaign(campaignId: string): boolean {
  return getPublicClaimCampaignIds().includes(campaignId);
}

export function getDefaultClaimCampaignId(): string {
  return getPublicClaimCampaignIds()[0] ?? "medusa-claim";
}
