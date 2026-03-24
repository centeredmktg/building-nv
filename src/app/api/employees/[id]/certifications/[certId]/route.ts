import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function computeVerifiedStatus(type: string, cardPhotoUrl: string | null): string {
  if (type === "OSHA_10" || type === "OSHA_30") {
    return cardPhotoUrl ? "verified" : "unverified";
  }
  return "verified";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { certId } = await params;
  const body = await req.json();
  const { cardPhotoUrl, expirationDate } = body as {
    cardPhotoUrl?: string;
    expirationDate?: string;
  };

  const existing = await prisma.certification.findUnique({ where: { id: certId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPhotoUrl = cardPhotoUrl !== undefined ? cardPhotoUrl : existing.cardPhotoUrl;
  const verifiedStatus = computeVerifiedStatus(existing.type, newPhotoUrl);

  const cert = await prisma.certification.update({
    where: { id: certId },
    data: {
      cardPhotoUrl: newPhotoUrl,
      expirationDate: expirationDate && expirationDate.trim() ? new Date(expirationDate) : existing.expirationDate,
      verifiedStatus,
    },
  });

  return NextResponse.json(cert);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { certId } = await params;
  await prisma.certification.delete({ where: { id: certId } });
  return NextResponse.json({ success: true });
}
