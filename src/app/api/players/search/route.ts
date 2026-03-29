import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/mlb-api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  try {
    const players = await searchPlayers(q);
    return NextResponse.json({ players: players.slice(0, 15) });
  } catch (error) {
    console.error("Failed to search players:", error);
    return NextResponse.json({ error: "Failed to search players" }, { status: 500 });
  }
}
