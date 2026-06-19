import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import {
  checkTokenHolding,
  computeHolderId,
} from "@/lib/partner/tokenPassport.server";
import {
  encryptAddress,
  isAddressEncryptionConfigured,
} from "@/lib/partner/crypto.server";
import {
  getTokenHolder,
  saveTokenHolder,
} from "@/lib/partner/tokenStore.server";

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Partner gating endpoint.
 * - `?address=0x...` => live on-chain re-check (always fresh), updates record.
 * - `?holderId=...`  => returns the last stored status (cheap, may be stale).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const partner = getPartnerById(id);
    if (!partner) {
      return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    const holderId = searchParams.get("holderId");

    if (address) {
      if (!isAddress(address)) {
        return NextResponse.json(
          { error: "address is not a valid Ethereum address." },
          { status: 400 },
        );
      }

      const { eligible, threshold } = await checkTokenHolding(partner, address);
      const id2 = computeHolderId(partner.id, address);
      const existing = await getTokenHolder(partner.id, id2);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + partner.validityHours * 60 * 60 * 1000,
      );

      await saveTokenHolder({
        partnerId: partner.id,
        holderId: id2,
        eligible,
        threshold,
        expiresAt: expiresAt.toISOString(),
        lastChecked: now.toISOString(),
        ...(existing?.telegramUsername
          ? { telegramUsername: existing.telegramUsername }
          : {}),
        ...(isAddressEncryptionConfigured()
          ? { addressEnc: encryptAddress(address) }
          : {}),
      });

      return NextResponse.json({
        eligible,
        holderId: id2,
        threshold,
        lastChecked: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        live: true,
      });
    }

    if (holderId) {
      const record = await getTokenHolder(partner.id, holderId);
      if (!record) {
        return NextResponse.json(
          { eligible: false, error: "No record for this holder." },
          { status: 404 },
        );
      }

      const active = new Date(record.expiresAt).getTime() > Date.now();
      return NextResponse.json({
        eligible: record.eligible && active,
        holderId: record.holderId,
        threshold: record.threshold,
        lastChecked: record.lastChecked,
        expiresAt: record.expiresAt,
        live: false,
      });
    }

    return NextResponse.json(
      { error: "Provide an `address` or `holderId` query param." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to fetch status.",
      },
      { status: 500 },
    );
  }
}
