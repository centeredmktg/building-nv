import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invitations = await prisma.bidInvitation.findMany({
    where: { bidRequestId: id },
    include: {
      subcontractor: { select: { id: true, name: true } },
      response: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(invitations);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { subcontractorIds } = body;

  if (!subcontractorIds?.length) {
    return NextResponse.json({ error: "subcontractorIds is required" }, { status: 400 });
  }

  const bidRequest = await prisma.bidRequest.findUnique({ where: { id } });
  if (!bidRequest) return NextResponse.json({ error: "Bid request not found" }, { status: 404 });

  const invitations = await prisma.bidInvitation.createMany({
    data: subcontractorIds.map((subId: string) => ({
      bidRequestId: id,
      subcontractorId: subId,
    })),
    skipDuplicates: true,
  });

  if (bidRequest.status === "draft") {
    await prisma.bidRequest.update({
      where: { id },
      data: { status: "sent" },
    });
  }

  return NextResponse.json({ created: invitations.count }, { status: 201 });
}
