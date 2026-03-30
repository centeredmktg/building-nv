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

  const reviews = await prisma.subcontractorReview.findMany({
    where: { subcontractorId: sub.companyId },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reviews);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({ where: { id }, select: { companyId: true } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { projectId, reviewerId, timeliness, communication, price, qualityOfWork, wouldRehire, notes } = body;

  if (!projectId || !reviewerId || !timeliness || !communication || !price || !qualityOfWork || wouldRehire == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate ratings are 1-5
  for (const val of [timeliness, communication, price, qualityOfWork]) {
    if (val < 1 || val > 5 || !Number.isInteger(val)) {
      return NextResponse.json({ error: "Ratings must be integers between 1 and 5" }, { status: 400 });
    }
  }

  const review = await prisma.subcontractorReview.create({
    data: {
      subcontractorId: sub.companyId,
      projectId,
      reviewerId,
      timeliness,
      communication,
      price,
      qualityOfWork,
      wouldRehire,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(review, { status: 201 });
}
