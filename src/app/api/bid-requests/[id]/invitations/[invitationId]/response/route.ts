import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, invitationId } = await params;
  const body = await req.json();
  const { amount, scopeNotes, estimatedDuration, availableStartDate } = body;

  if (amount == null || amount <= 0) {
    return NextResponse.json({ error: "amount is required and must be positive" }, { status: 400 });
  }

  const invitation = await prisma.bidInvitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.bidRequestId !== id) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const response = await prisma.bidResponse.create({
    data: {
      bidInvitationId: invitationId,
      amount: parseFloat(amount),
      scopeNotes: scopeNotes?.trim() || null,
      estimatedDuration: estimatedDuration?.trim() || null,
      availableStartDate: availableStartDate ? new Date(availableStartDate) : null,
    },
  });

  await prisma.bidInvitation.update({
    where: { id: invitationId },
    data: { status: "responded" },
  });

  const pendingCount = await prisma.bidInvitation.count({
    where: { bidRequestId: id, status: { in: ["pending", "viewed"] } },
  });
  if (pendingCount === 0) {
    await prisma.bidRequest.update({
      where: { id },
      data: { status: "responses_received" },
    });
  }

  return NextResponse.json(response, { status: 201 });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, invitationId } = await params;
  const body = await req.json();

  const invitation = await prisma.bidInvitation.findUnique({
    where: { id: invitationId },
    include: { response: true },
  });

  if (!invitation || invitation.bidRequestId !== id || !invitation.response) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.status === "accepted") {
    await prisma.$transaction([
      prisma.bidResponse.update({
        where: { id: invitation.response.id },
        data: { status: "accepted" },
      }),
      prisma.bidResponse.updateMany({
        where: {
          bidInvitation: { bidRequestId: id },
          id: { not: invitation.response.id },
        },
        data: { status: "rejected" },
      }),
    ]);
  } else {
    await prisma.bidResponse.update({
      where: { id: invitation.response.id },
      data: { status: body.status },
    });
  }

  return NextResponse.json({ success: true });
}
