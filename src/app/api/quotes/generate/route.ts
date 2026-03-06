import { NextRequest, NextResponse } from "next/server";
import { generateQuoteFromScope } from "@/lib/claude";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scopeText } = await req.json();
  if (!scopeText) {
    return NextResponse.json({ error: "scopeText is required" }, { status: 400 });
  }

  const result = await generateQuoteFromScope(scopeText);
  return NextResponse.json(result);
}
