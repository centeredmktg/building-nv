import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Require authenticated session — this endpoint is internal only
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "uploads";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Limit to images only for cert card uploads
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are accepted" },
      { status: 400 }
    );
  }

  // 10MB max
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url });
}
