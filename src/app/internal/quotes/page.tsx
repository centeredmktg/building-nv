import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { resolveQuoteClient } from "@/lib/quote-client";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    include: { quoteContacts: { include: { contact: true } }, quoteCompanies: { include: { company: true } } },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<string, string> = {
    draft: "text-text-muted border-border",
    sent: "text-accent border-accent",
    accepted: "text-green-400 border-green-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Quotes</h1>
        <Link
          href="/internal/quotes/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Quote
        </Link>
      </div>

      {quotes.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No quotes yet.</p>
          <Link href="/internal/quotes/new" className="text-accent text-sm hover:underline">
            Create your first quote
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/internal/quotes/${quote.id}/edit`}
              className="flex items-center justify-between px-6 py-4 hover:bg-surface transition-colors"
            >
              <div>
                <p className="text-text-primary font-medium">{quote.title}</p>
                <p className="text-text-muted text-sm mt-0.5">
                  {(() => { const c = resolveQuoteClient(quote); return c.name + (c.company ? ` · ${c.company}` : ""); })()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-text-muted text-sm">
                  {new Date(quote.createdAt).toLocaleDateString()}
                </span>
                <span
                  className={`text-xs border px-2 py-0.5 rounded-full uppercase tracking-wide ${statusColors[quote.status]}`}
                >
                  {quote.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
