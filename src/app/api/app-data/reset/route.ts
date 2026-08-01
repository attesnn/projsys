import { NextResponse } from "next/server";
import { resetAppDataInDb } from "@/lib/appDataDb";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await resetAppDataInDb();
    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/app-data/reset", err);
    return NextResponse.json(
      { error: "Failed to reset app data" },
      { status: 500 }
    );
  }
}
