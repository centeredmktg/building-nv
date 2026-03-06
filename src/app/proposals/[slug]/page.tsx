import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calculateQuoteTotals } from "@/lib/pricing";
import AcceptanceBlock from "./AcceptanceBlock";

export default async function ProposalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quote = await prisma.quote.findUnique({
    where: { slug },
    include: {
      client: true,
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
    },
  });

  if (!quote) notFound();

  const allItems = quote.sections.flatMap((s) =>
    s.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      <div className="max-w-3xl mx-auto px-8 py-12 print:px-0 print:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-8 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Building NV</h1>
            <p className="text-gray-500 text-sm">Commercial Tenant Improvement · Reno, Nevada</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">PROPOSAL</p>
            <p className="text-gray-500 text-sm">
              {new Date(quote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Client + Job Site */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-gray-200">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Client</p>
            <p className="font-semibold text-gray-900">{quote.client.name}</p>
            {quote.client.company && <p className="text-gray-600 text-sm">{quote.client.company}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Job Site</p>
            <p className="font-semibold text-gray-900">{quote.address}</p>
            <p className="text-gray-600 text-sm">{quote.projectType}</p>
          </div>
        </div>

        <p className="text-gray-700 mb-8">
          Thank you for the opportunity to provide this proposal. Building NV proposes to perform the following work as outlined below.
        </p>

        {/* Line Items */}
        {quote.sections.map((sec) => (
          <div key={sec.id} className="mb-6">
            <h2 className="font-bold text-gray-900 underline mb-3">{sec.title}:</h2>
            <div className="space-y-1">
              {sec.items.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between text-sm">
                  <span className="text-gray-700 flex-1 pr-4">— {item.description}</span>
                  <span className="text-gray-900 font-medium whitespace-nowrap">
                    ${(item.quantity * item.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Totals */}
        <div className="border-t border-gray-200 pt-6 mt-6 mb-8">
          {totals.materialsMarkupAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Materials Markup ({quote.materialMarkupPct}%)</span>
              <span>${totals.materialsMarkupAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Overhead ({quote.overheadPct}%)</span>
            <span>${totals.overheadAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mb-4">
            <span>Profit ({quote.profitPct}%)</span>
            <span>${totals.profitAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-gray-300 pt-3">
            <span>Total Cost:</span>
            <span>${totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 underline mb-2">Note:</h3>
          <p className="text-sm text-gray-700">{quote.paymentTerms}</p>
        </div>

        {/* Exclusions */}
        <div className="mb-6">
          <h3 className="font-bold text-gray-900 underline mb-2">Exclusions</h3>
          <div className="border border-gray-300 p-3 text-sm text-gray-700">
            {quote.exclusions}
          </div>
        </div>

        {/* Terms */}
        <div className="mb-10 text-xs text-gray-600 space-y-2">
          <h3 className="font-bold text-gray-900 text-sm underline mb-2">Terms & Conditions:</h3>
          <p><strong>A.</strong> Interest of 2% per month will be added on all overdue accounts beginning on the day of delinquency.</p>
          <p><strong>B.</strong> Any alteration or deviation from the above specifications requiring extra cost will become an extra charge via written change order.</p>
          <p><strong>C.</strong> All agreements contingent upon strikes, accidents, or delays beyond our control including material availability and pricing changes.</p>
          <p><strong>D.</strong> Warranty void by earthquake, tornado, or other act of God, or by non-payment. Warranty coverage begins at time of final payment.</p>
          <p><strong>E.</strong> This proposal does not include labor or material for unforeseen conditions. Additional repair fees will be added via change order.</p>
          <p><strong>F.</strong> Payment due within thirty days of date of invoice (net 30).</p>
        </div>

        {/* Acceptance */}
        <AcceptanceBlock
          slug={quote.slug}
          accepted={!!quote.acceptance}
          signerName={quote.acceptance?.signerName}
          acceptedAt={quote.acceptance?.acceptedAt?.toString()}
        />

      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
