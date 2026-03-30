import { prisma } from "@/lib/prisma";
import NewBidRequestForm from "./NewBidRequestForm";

export const dynamic = "force-dynamic";

export default async function NewBidRequestPage() {
  const quotes = await prisma.quote.findMany({
    where: { status: { in: ["sent", "quote_signed"] } },
    include: {
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const subs = await prisma.subcontractorProfile.findMany({
    where: { onboardingStatus: "approved" },
    include: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { company: { name: "asc" } },
  });

  const serializedQuotes = quotes.map((q) => ({
    id: q.id,
    title: q.title,
    projectType: q.projectType,
    address: q.address,
    sections: q.sections.map((s) => ({
      id: s.id,
      title: s.title,
      trade: s.trade,
      items: s.items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit,
        trade: i.trade,
      })),
    })),
  }));

  const serializedSubs = subs.map((s) => ({
    profileId: s.id,
    companyId: s.company.id,
    companyName: s.company.name,
    trades: s.trades,
    bidLimit: s.bidLimit,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">New Bid Request</h1>
      <NewBidRequestForm quotes={serializedQuotes} subs={serializedSubs} />
    </div>
  );
}
