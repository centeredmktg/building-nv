import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import QuoteEditor from "@/components/internal/QuoteEditor";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
      contract: {
        include: { changeOrders: { orderBy: { number: 'asc' } } },
      },
    },
  });

  if (!quote) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <QuoteEditor quote={quote as any} />;
}
