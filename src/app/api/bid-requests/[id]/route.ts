import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bidRequest = await prisma.bidRequest.findUnique({
    where: { id },
    include: {
      quote: { select: { id: true, slug: true, title: true } },
      invitations: {
        include: {
          subcontractor: {
            include: {
              subcontractorProfile: { select: { trades: true, licenseNumber: true, bidLimit: true, onboardingStatus: true } },
              subcontractorReviews: {
                select: { timeliness: true, communication: true, price: true, qualityOfWork: true, wouldRehire: true, createdAt: true },
              },
              contactNotes: {
                include: { contact: { select: { id: true, firstName: true, lastName: true } } },
              },
            },
          },
          response: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!bidRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bidRequest);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const bidRequest = await prisma.bidRequest.update({
    where: { id },
    data: {
      status: body.status,
      startWindow: body.startWindow,
      specialRequirements: body.specialRequirements?.trim() || null,
      responseDeadline: body.responseDeadline ? new Date(body.responseDeadline) : undefined,
    },
  });

  return NextResponse.json(bidRequest);
}
