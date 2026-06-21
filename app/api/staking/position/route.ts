import { NextResponse } from "next/server";
import { fetchStakingUserPosition } from "@/lib/staking/streamflow.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim();
  if (!wallet) {
    return NextResponse.json(
      { error: "Missing wallet query parameter." },
      { status: 400 },
    );
  }

  try {
    const position = await fetchStakingUserPosition(wallet);
    if (!position) {
      return NextResponse.json(
        { error: "Staking is not configured." },
        { status: 503 },
      );
    }
    return NextResponse.json(position, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[staking/position]", error);
    return NextResponse.json(
      {
        error: "Failed to load staking position.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
