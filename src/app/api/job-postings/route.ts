import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const postings = await prisma.jobPosting.findMany({
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(postings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, location, type } = await req.json();

  if (!title?.trim() || !description?.trim() || !location?.trim()) {
    return NextResponse.json({ error: "Title, description, and location are required" }, { status: 400 });
  }

  const posting = await prisma.jobPosting.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      type: type?.trim() || "full-time",
    },
  });
  return NextResponse.json(posting, { status: 201 });
}
