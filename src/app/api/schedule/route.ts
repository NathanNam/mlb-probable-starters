import { NextRequest, NextResponse } from "next/server";
import { fetchSchedule } from "@/lib/mlb-api";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("teamId");
  const season = request.nextUrl.searchParams.get("season") || "2026";

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  try {
    const games = await fetchSchedule(parseInt(teamId, 10), parseInt(season, 10));
    return NextResponse.json({ games });
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}
