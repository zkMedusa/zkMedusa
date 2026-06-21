import { NextResponse } from "next/server";
import { fetchStakingGlobalStats } from "@/lib/staking/streamflow.server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    const stats = await fetchStakingGlobalStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[staking/stats]", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to load staking stats.",
        detail,
      },
      { status: 500 },
    );
  }
}
