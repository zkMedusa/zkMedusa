import { NextResponse } from "next/server";
import {
  processStakeNotify,
  type StakeNotifyRequest,
} from "@/lib/telegram/stakeNotify.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBody(body: unknown): StakeNotifyRequest {
  if (!isRecord(body)) {
    throw new Error("Invalid request body.");
  }

  const signature =
    typeof body.signature === "string" ? body.signature.trim() : "";
  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const amount = typeof body.amount === "string" ? body.amount.trim() : "";
  const tierDays =
    typeof body.tierDays === "number"
      ? body.tierDays
      : Number.parseInt(String(body.tierDays ?? ""), 10);

  if (!signature || !wallet || !amount || !Number.isFinite(tierDays)) {
    throw new Error("signature, wallet, tierDays, and amount are required.");
  }

  return { signature, wallet, tierDays, amount };
}

export async function POST(request: Request) {
  try {
    const body = parseBody(await request.json());
    const result = await processStakeNotify(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[staking/notify]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
