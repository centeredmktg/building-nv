import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// OSHA_10 and OSHA_30 require a card photo to be verified.
// verifiedStatus is computed server-side — never trusted from client.
function computeVerifiedStatus(type: string, cardPhotoUrl: string | null): string {
  if (type === "OSHA_10" || type === "OSHA_30") {
    return cardPhotoUrl ? "verified" : "unverified";
  }
  // For FIRST_AID and OTHER, photo is optional — treat as verified if no photo required
  return "verified";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: employeeId } = await params;
  const body = await req.json();
  const { type, issueDate, expirationDate, cardPhotoUrl } = body as {
    type: string;
    issueDate: string;
    expirationDate?: string;
    cardPhotoUrl?: string;
  };

  if (!type || !issueDate) {
    return NextResponse.json(
      { error: "type and issueDate are required" },
      { status: 400 }
    );
  }

  const validTypes = ["OSHA_10", "OSHA_30", "FIRST_AID", "OTHER"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid certification type" }, { status: 400 });
  }

  const verifiedStatus = computeVerifiedStatus(type, cardPhotoUrl ?? null);

  const cert = await prisma.certification.create({
    data: {
      employeeId,
      type,
      issueDate: new Date(issueDate),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      cardPhotoUrl: cardPhotoUrl ?? null,
      verifiedStatus,
    },
  });

  return NextResponse.json(cert, { status: 201 });
}
