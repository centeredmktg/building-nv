import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const posting = await prisma.jobPosting.findUnique({
    where: { id },
    include: {
      applications: { orderBy: { createdAt: "desc" } },
      _count: { select: { applications: true } },
    },
  });

  if (!posting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(posting);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { title, description, location, type, status } = await req.json();

  const posting = await prisma.jobPosting.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(location !== undefined && { location: location.trim() }),
      ...(type !== undefined && { type: type.trim() }),
      ...(status !== undefined && { status }),
    },
  });
  return NextResponse.json(posting);
}
