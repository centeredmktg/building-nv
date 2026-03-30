import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({
    where: { id },
    include: {
      company: {
        include: {
          contacts: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          contactNotes: true,
          subcontractorReviews: {
            include: { project: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          bidInvitations: {
            include: {
              bidRequest: { select: { id: true, requiredTrade: true, status: true, createdAt: true } },
              response: { select: { amount: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sub);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const sub = await prisma.subcontractorProfile.update({
    where: { id },
    data: {
      trades: body.trades,
      licenseNumber: body.licenseNumber?.trim() || null,
      bidLimit: body.bidLimit != null ? parseFloat(body.bidLimit) : null,
      onboardingStatus: body.onboardingStatus,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      w9OnFile: body.w9OnFile,
      notes: body.notes?.trim() || null,
      company: {
        update: {
          name: body.companyName?.trim(),
          phone: body.phone?.trim() || null,
          domain: body.domain?.trim() || null,
        },
      },
    },
    include: { company: true },
  });

  return NextResponse.json(sub);
}
