import { NextResponse } from "next/server";
import {
  getLastBuybackRun,
  getLastSuccessfulBuybackRun,
  listBuybackHistory,
} from "@/lib/staking/buybackStore.server";
import {
  getBuybackMinSol,
  getBuybackMinUsdc,
  getBuybackRpcUrl,
  getPumpClaimMinLamports,
  getSolReserveLamports,
  isBuybackConfigured,
  isBuybackEnabled,
} from "@/lib/staking/buyback.config.server";
import { DRIP_INTERVAL_MINUTES } from "@/lib/staking/config";

export const dynamic = "force-dynamic";

function authorizeStatus(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return true;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function redactRpcUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = parsed.search ? "?…" : "";
    parsed.pathname = parsed.pathname.replace(/\/[a-f0-9]{16,}/i, "/…");
    return parsed.toString();
  } catch {
    return "invalid-url";
  }
}

export async function GET(request: Request) {
  if (!authorizeStatus(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [lastRun, lastSuccess, history] = await Promise.all([
    getLastBuybackRun(),
    getLastSuccessfulBuybackRun(),
    listBuybackHistory(10),
  ]);

  return NextResponse.json({
    configured: isBuybackConfigured(),
    enabled: isBuybackEnabled(),
    dripIntervalMinutes: DRIP_INTERVAL_MINUTES,
    thresholds: {
      minBuybackSol: getBuybackMinSol(),
      minBuybackUsdc: getBuybackMinUsdc(),
      minPumpClaimSol: Number(getPumpClaimMinLamports()) / 1e9,
      solReserve: Number(getSolReserveLamports()) / 1e9,
    },
    rpc: {
      buybackHttp: redactRpcUrl(getBuybackRpcUrl()),
    },
    lastRun,
    lastSuccess,
    recentRuns: history,
  });
}
