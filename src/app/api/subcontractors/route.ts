import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await prisma.subcontractorProfile.findMany({
    include: {
      company: {
        include: {
          contacts: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          subcontractorReviews: {
            select: { timeliness: true, communication: true, price: true, qualityOfWork: true, wouldRehire: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute scorecards
  const result = subs.map((sub) => {
    const reviews = sub.company.subcontractorReviews;
    const count = reviews.length;
    const avg = (field: "timeliness" | "communication" | "price" | "qualityOfWork") =>
      count > 0 ? reviews.reduce((sum, r) => sum + r[field], 0) / count : null;
    const rehireCount = reviews.filter((r) => r.wouldRehire).length;

    return {
      id: sub.id,
      company: {
        id: sub.company.id,
        name: sub.company.name,
        type: sub.company.type,
        domain: sub.company.domain,
        phone: sub.company.phone,
        contacts: sub.company.contacts,
      },
      trades: sub.trades,
      licenseNumber: sub.licenseNumber,
      bidLimit: sub.bidLimit,
      onboardingStatus: sub.onboardingStatus,
      insuranceExpiry: sub.insuranceExpiry,
      w9OnFile: sub.w9OnFile,
      notes: sub.notes,
      scorecard: {
        jobsCompleted: count,
        avgTimeliness: avg("timeliness"),
        avgCommunication: avg("communication"),
        avgPrice: avg("price"),
        avgQualityOfWork: avg("qualityOfWork"),
        wouldRehirePercent: count > 0 ? (rehireCount / count) * 100 : null,
        lastJobDate: count > 0
          ? reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt.toISOString()
          : null,
      },
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { companyName, phone, domain, trades, licenseNumber, bidLimit, notes } = body;

  if (!companyName?.trim() || !trades?.length) {
    return NextResponse.json({ error: "Company name and at least one trade are required" }, { status: 400 });
  }

  // Create Company + SubcontractorProfile in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName.trim(),
        type: "subcontractor",
        phone: phone?.trim() || null,
        domain: domain?.trim() || null,
      },
    });

    const profile = await tx.subcontractorProfile.create({
      data: {
        companyId: company.id,
        trades,
        licenseNumber: licenseNumber?.trim() || null,
        bidLimit: bidLimit ? parseFloat(bidLimit) : null,
        notes: notes?.trim() || null,
      },
      include: { company: true },
    });

    return profile;
  });

  return NextResponse.json(result, { status: 201 });
}
