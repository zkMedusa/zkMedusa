import { NextResponse } from "next/server";
import { getPartnerById } from "@/lib/partner/partners";
import { consumeNonce } from "@/lib/partner/nonce.server";
import {
  checkTokenHolding,
  computeHolderId,
  buildTokenPassport,
  recoverOwnership,
} from "@/lib/partner/tokenPassport.server";
import {
  encryptAddress,
  isAddressEncryptionConfigured,
} from "@/lib/partner/crypto.server";
import {
  findTokenHolderByTelegram,
  saveTokenHolder,
} from "@/lib/partner/tokenStore.server";
import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "@/lib/partner/tokenPassport";

interface VerifyRequest {
  address: string;
  signature: `0x${string}`;
  nonce: string;
  issuedAt: string;
  telegramUsername?: string;
}

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const partner = getPartnerById(id);
    if (!partner) {
      return NextResponse.json({ error: "Unknown partner." }, { status: 404 });
    }

    const body = (await request.json()) as VerifyRequest;
    if (!body.address || !body.signature || !body.nonce || !body.issuedAt) {
      return NextResponse.json(
        { error: "address, signature, nonce and issuedAt are required." },
        { status: 400 },
      );
    }

    if (!isAddress(body.address)) {
      return NextResponse.json(
        { error: "address is not a valid Ethereum address." },
        { status: 400 },
      );
    }

    let telegramUsername: string | undefined;
    if (partner.collectTelegram) {
      if (!body.telegramUsername?.trim()) {
        return NextResponse.json(
          { error: "telegramUsername is required for this partner." },
          { status: 400 },
        );
      }
      if (!isValidTelegramUsername(body.telegramUsername)) {
        return NextResponse.json(
          {
            error:
              "Invalid Telegram username. Use 5–32 characters: letters, numbers, underscores; must start with a letter.",
          },
          { status: 400 },
        );
      }
      telegramUsername = normalizeTelegramUsername(body.telegramUsername);
    }

    // Single-use nonce prevents signature replay.
    if (!(await consumeNonce(body.nonce))) {
      return NextResponse.json(
        { error: "Nonce is invalid or expired. Refresh and try again." },
        { status: 400 },
      );
    }

    const owner = await recoverOwnership({
      partnerName: partner.name,
      address: body.address,
      signature: body.signature,
      nonce: body.nonce,
      issuedAt: body.issuedAt,
    });

    if (!owner) {
      return NextResponse.json(
        { error: "Signature did not match the connected wallet." },
        { status: 401 },
      );
    }

    const { eligible, threshold } = await checkTokenHolding(partner, owner);

    // Hash immediately; the raw address is never persisted.
    const holderId = computeHolderId(partner.id, owner);

    if (telegramUsername) {
      const existingTelegram = await findTokenHolderByTelegram(
        partner.id,
        telegramUsername,
      );
      if (existingTelegram && existingTelegram.holderId !== holderId) {
        return NextResponse.json(
          {
            error:
              "This Telegram username is already linked to another wallet for this partner.",
          },
          { status: 409 },
        );
      }
    }

    const passport = buildTokenPassport({
      partner,
      holderId,
      eligible,
      threshold,
      telegramUsername,
    });

    await saveTokenHolder({
      partnerId: partner.id,
      holderId,
      eligible,
      threshold,
      expiresAt: passport.expiresAt,
      lastChecked: passport.issuedAt,
      ...(telegramUsername ? { telegramUsername } : {}),
      // Encrypted so the daily cron can re-check without the user present.
      ...(isAddressEncryptionConfigured()
        ? { addressEnc: encryptAddress(owner) }
        : {}),
    });

    if (!eligible) {
      return NextResponse.json(
        {
          eligible: false,
          threshold,
          error: `This wallet holds fewer than ${threshold} ${partner.name} tokens.`,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ eligible: true, passport });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify token holding.",
      },
      { status: 500 },
    );
  }
}
