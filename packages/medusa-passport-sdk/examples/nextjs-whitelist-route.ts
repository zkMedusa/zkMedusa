/**
 * Example Next.js API route for a partner presale app.
 *
 * POST /api/whitelist
 * Body: { passport: MedusaPassport, claimWallet: string }
 */
import {
  MedusaPassportClient,
  PASSPORT_TIERS,
  type MedusaPassport,
} from "@medusa/passport-sdk";

const client = new MedusaPassportClient({
  baseUrl: process.env.MEDUSA_PASSPORT_BASE_URL!,
  apiKey: process.env.MEDUSA_PARTNER_API_KEY!,
});

export async function POST(request: Request) {
  const body = (await request.json()) as {
    passport: MedusaPassport;
    claimWallet: string;
  };

  const verification = await client.verify(body.passport, {
    minTier: PASSPORT_TIERS.BRONZE,
  });

  if (!verification.valid) {
    return Response.json(
      { error: verification.errors.join(" ") },
      { status: 400 },
    );
  }

  const registration = await client.register({
    passport: body.passport,
    claimWallet: body.claimWallet,
    campaignId: process.env.MEDUSA_PARTNER_CAMPAIGN_ID!,
  });

  return Response.json({
    whitelisted: true,
    tier: registration.tierLabel,
    wallet: registration.claimWallet,
  });
}
