import { NextRequest, NextResponse } from "next/server";
import { fetchPlayer } from "@/lib/mlb-api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (isNaN(playerId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  try {
    const player = await fetchPlayer(playerId);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    return NextResponse.json({ player });
  } catch (error) {
    console.error("Failed to fetch player:", error);
    return NextResponse.json({ error: "Failed to fetch player" }, { status: 500 });
  }
}
