import { NextResponse } from "next/server";
import { runBuyback } from "@/lib/staking/buyback.server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return true;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await runBuyback({ dryRun, force });
    return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 500 });
  } catch (error) {
    console.error("[staking/cron/buyback]", error);
    return NextResponse.json(
      { error: "Buyback run failed.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
