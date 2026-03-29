import { NextResponse } from "next/server";
import { fetchTeams } from "@/lib/mlb-api";

export async function GET() {
  try {
    const teams = await fetchTeams();
    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 });
  }
}
