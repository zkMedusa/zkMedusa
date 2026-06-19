import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import { checkTokenHolding } from "@/lib/partner/tokenPassport.server";
import {
  decryptAddress,
  isAddressEncryptionConfigured,
} from "@/lib/partner/crypto.server";
import {
  listAllTokenHolders,
  saveTokenHolder,
} from "@/lib/partner/tokenStore.server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily refresh: re-checks every stored holder's on-chain balance and updates
 * their eligibility + validity window, so passports stay current without the
 * user manually re-verifying. Triggered by Vercel Cron (see vercel.json).
 *
 * Auth: when CRON_SECRET is set, Vercel Cron sends `Authorization: Bearer
 * <CRON_SECRET>`; we reject anything else. Without CRON_SECRET the route is
 * open (dev only) — set one in production.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  if (!isAddressEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "MEDUSA_PARTNER_ENCRYPTION_KEY is not configured; cannot refresh holders.",
      },
      { status: 503 },
    );
  }

  const holders = await listAllTokenHolders();
  let refreshed = 0;
  let dropped = 0;
  let skipped = 0;
  let failed = 0;

  for (const holder of holders) {
    const partner = holder.addressEnc
      ? getPartnerById(holder.partnerId)
      : null;
    if (!holder.addressEnc || !partner) {
      skipped += 1;
      continue;
    }

    try {
      const address = decryptAddress(holder.addressEnc);
      const { eligible, threshold } = await checkTokenHolding(partner, address);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + partner.validityHours * 60 * 60 * 1000,
      );

      await saveTokenHolder({
        partnerId: holder.partnerId,
        holderId: holder.holderId,
        eligible,
        threshold,
        addressEnc: holder.addressEnc,
        ...(holder.telegramUsername
          ? { telegramUsername: holder.telegramUsername }
          : {}),
        expiresAt: expiresAt.toISOString(),
        lastChecked: now.toISOString(),
      });

      refreshed += 1;
      if (!eligible) {
        dropped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    total: holders.length,
    refreshed,
    dropped,
    skipped,
    failed,
    ranAt: new Date().toISOString(),
  });
}
