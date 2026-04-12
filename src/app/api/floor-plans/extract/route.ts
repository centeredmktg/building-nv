import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractFloorPlan } from "@/lib/floor-plan-extract";
import { extractionToCanvasData } from "@/lib/floor-plan-types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { imageUrl } = body;

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  try {
    const extraction = await extractFloorPlan(imageUrl);
    const canvasData = extractionToCanvasData(extraction);
    return NextResponse.json({ extraction, canvasData });
  } catch (err) {
    console.error("Floor plan extraction error:", err);
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
