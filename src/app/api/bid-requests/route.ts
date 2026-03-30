import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateScopeText, extractGeneralLocation } from "@/lib/bidRequest";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bidRequests = await prisma.bidRequest.findMany({
    include: {
      invitations: {
        select: { id: true, status: true, response: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = bidRequests.map((br) => ({
    id: br.id,
    projectType: br.projectType,
    generalLocation: br.generalLocation,
    requiredTrade: br.requiredTrade,
    responseDeadline: br.responseDeadline,
    status: br.status,
    startWindow: br.startWindow,
    invitationCount: br.invitations.length,
    responseCount: br.invitations.filter((inv) => inv.response).length,
    createdAt: br.createdAt,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { quoteId, lineItemIds, requiredTrade, responseDeadline, startWindow, specialRequirements } = body;

  if (!quoteId || !lineItemIds?.length || !requiredTrade || !responseDeadline) {
    return NextResponse.json({ error: "quoteId, lineItemIds, requiredTrade, and responseDeadline are required" }, { status: 400 });
  }

  // Fetch the quote with selected line items
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      projectType: true,
      address: true,
      projectId: true,
    },
  });

  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const lineItems = await prisma.lineItem.findMany({
    where: { id: { in: lineItemIds } },
    select: { description: true, quantity: true, unit: true },
  });

  const scopeOfWork = generateScopeText(lineItems);
  const generalLocation = extractGeneralLocation(quote.address);

  const bidRequest = await prisma.bidRequest.create({
    data: {
      quoteId: quote.id,
      projectId: quote.projectId,
      projectType: quote.projectType,
      generalLocation,
      scopeOfWork,
      requiredTrade,
      responseDeadline: new Date(responseDeadline),
      startWindow: startWindow || null,
      specialRequirements: specialRequirements?.trim() || null,
    },
  });

  return NextResponse.json(bidRequest, { status: 201 });
}
