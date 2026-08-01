import { NextResponse } from "next/server";
import {
  ensureSeededAppData,
  loadAppDataFromDb,
  saveAppDataToDb,
} from "@/lib/appDataDb";
import type { AppData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await ensureSeededAppData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/app-data", err);
    return NextResponse.json(
      { error: "Failed to load app data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as AppData;
    if (!body || body.version !== 1 || !Array.isArray(body.projects)) {
      return NextResponse.json({ error: "Invalid AppData" }, { status: 400 });
    }
    await saveAppDataToDb(body);
    const data = await loadAppDataFromDb();
    return NextResponse.json(data);
  } catch (err) {
    console.error("PUT /api/app-data", err);
    return NextResponse.json(
      { error: "Failed to save app data" },
      { status: 500 }
    );
  }
}
