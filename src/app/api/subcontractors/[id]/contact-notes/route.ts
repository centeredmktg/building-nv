import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({ where: { id }, select: { companyId: true } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await prisma.contactNote.findMany({
    where: { companyId: sub.companyId },
    include: { contact: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({ where: { id }, select: { companyId: true } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { contactId, preferred, flagged, notes } = body;

  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  const note = await prisma.contactNote.upsert({
    where: { contactId_companyId: { contactId, companyId: sub.companyId } },
    update: {
      preferred: preferred ?? false,
      flagged: flagged ?? false,
      notes: notes?.trim() || null,
    },
    create: {
      contactId,
      companyId: sub.companyId,
      preferred: preferred ?? false,
      flagged: flagged ?? false,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
