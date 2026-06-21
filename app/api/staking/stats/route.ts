import { NextResponse } from "next/server";
import { fetchStakingGlobalStats } from "@/lib/staking/streamflow.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const stats = await fetchStakingGlobalStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[staking/stats]", error);
    return NextResponse.json(
      {
        error: "Failed to load staking stats.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
