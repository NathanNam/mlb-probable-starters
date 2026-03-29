import { NextRequest, NextResponse } from "next/server";
import { fetchGameLog } from "@/lib/mlb-api";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  const season = request.nextUrl.searchParams.get("season") || "2026";

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const splits = await fetchGameLog(parseInt(playerId, 10), parseInt(season, 10));
    return NextResponse.json({ splits });
  } catch (error) {
    console.error("Failed to fetch game log:", error);
    return NextResponse.json({ error: "Failed to fetch game log" }, { status: 500 });
  }
}
