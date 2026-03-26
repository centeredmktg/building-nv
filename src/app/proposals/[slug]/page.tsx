import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { calculateQuoteTotals, calculatePaymentSchedule } from "@/lib/pricing";
import AcceptanceBlock from "./AcceptanceBlock";
import { resolveQuoteClient } from "@/lib/quote-client";
import { durationToWeeks } from "@/lib/milestone-defaults";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function ProposalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const quote = await prisma.quote.findFirst({
    where: {
      OR: [
        { slug: slug },
        { signingToken: slug },
      ],
    },
    include: {
      quoteContacts: { include: { contact: true } },
      quoteCompanies: { include: { company: true } },
      sections: {
        include: { items: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
      acceptance: true,
      milestones: { orderBy: { position: "asc" } },
    },
  });

  if (!quote) notFound();

  const client = resolveQuoteClient(quote);
  const allItems = quote.sections.flatMap((s) =>
    s.items.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity, isMaterial: i.isMaterial }))
  );
  const totals = calculateQuoteTotals(allItems, quote.materialMarkupPct, quote.overheadPct, quote.profitPct);
  const dateStr = new Date(quote.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const schedule = calculatePaymentSchedule(
    quote.milestones.map((m) => ({
      name: m.name,
      weekNumber: m.weekNumber,
      paymentPct: m.paymentPct,
      paymentLabel: m.paymentLabel,
    })),
    totals.total
  );
  const maxWeek = quote.milestones.length > 0
    ? Math.max(...quote.milestones.map((m) => m.weekNumber)) + 1
    : 0;
  const anchorDate = quote.estimatedStartDate
    ? new Date(quote.estimatedStartDate)
    : new Date();
  const weekDate = (wk: number) => {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + wk * 7);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1917] print:bg-white">

      {/* Hero header band */}
      <div className="bg-[#1E2A38] print:bg-[#1E2A38]">
        <div className="max-w-3xl mx-auto px-8 pt-10 pb-8 print:px-6 print:pt-6 print:pb-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-0.5 bg-[#C17F3A]" />
                <span className="text-[#C17F3A] text-[11px] font-semibold uppercase tracking-[0.2em]">
                  Proposal
                </span>
              </div>
              <h1 className="text-[28px] font-bold text-white tracking-tight leading-tight">
                Building NV
              </h1>
              <p className="text-[#8A9BB0] text-sm mt-0.5">
                Commercial Tenant Improvement &middot; Reno, Nevada
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[11px] uppercase tracking-[0.15em] mb-0.5">Date</p>
              <p className="text-white text-sm font-medium">{dateStr}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copper accent line */}
      <div className="h-[3px] bg-gradient-to-r from-[#C17F3A] via-[#D4973F] to-[#C17F3A]" />

      <div className="max-w-3xl mx-auto px-8 print:px-6">

        {/* Client + Job Site cards */}
        <div className="grid grid-cols-2 gap-6 -mt-5 mb-10 print:mb-6">
          <div className="bg-white rounded shadow-sm border border-[#E8E4DD] px-5 py-4 print:shadow-none">
            <p className="text-[10px] font-bold text-[#C17F3A] uppercase tracking-[0.2em] mb-2">Client</p>
            <p className="font-semibold text-[#1A1917] text-[15px] leading-snug">{client.name}</p>
            {client.company && (
              <p className="text-[#6B6560] text-sm mt-0.5">{client.company}</p>
            )}
          </div>
          <div className="bg-white rounded shadow-sm border border-[#E8E4DD] px-5 py-4 print:shadow-none">
            <p className="text-[10px] font-bold text-[#C17F3A] uppercase tracking-[0.2em] mb-2">Job Site</p>
            <p className="font-semibold text-[#1A1917] text-[15px] leading-snug">{quote.address}</p>
            <p className="text-[#6B6560] text-sm mt-0.5">{quote.projectType}</p>
          </div>
        </div>

        {/* Intro */}
        <p className="text-[#4A4540] leading-relaxed mb-10 print:mb-6">
          Thank you for the opportunity to provide this proposal. Building NV proposes to perform the following work as outlined below.
        </p>

        {/* Scope sections */}
        <div className="space-y-8 mb-10 print:space-y-4 print:mb-6">
          {quote.sections.map((sec, si) => (
            <div key={sec.id}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1E2A38] text-white text-xs font-bold shrink-0">
                  {si + 1}
                </span>
                <h2 className="text-[17px] font-bold text-[#1A1917] tracking-tight">
                  {sec.title}
                </h2>
                <div className="flex-1 h-px bg-[#DDD8D0]" />
              </div>

              {/* Line items */}
              <div className="bg-white rounded border border-[#E8E4DD] overflow-hidden print:border-[#ccc]">
                {sec.items.map((item, ii) => {
                  const lineTotal = item.quantity * item.unitPrice;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-baseline justify-between px-5 py-2.5 text-sm ${
                        ii % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"
                      } ${ii > 0 ? "border-t border-[#F0EDE8]" : ""}`}
                    >
                      <span className="text-[#3A3530] flex-1 pr-6 leading-snug">
                        {item.description}
                      </span>
                      <span className="text-[#1A1917] font-semibold tabular-nums whitespace-nowrap">
                        {lineTotal > 0 ? `$${fmt(lineTotal)}` : "\u2014"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded border border-[#E8E4DD] overflow-hidden mb-10 print:mb-6">
          <div className="px-5 py-3 space-y-2">
            {totals.materialsMarkupAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#6B6560]">Materials Markup ({quote.materialMarkupPct}%)</span>
                <span className="text-[#3A3530] tabular-nums">${fmt(totals.materialsMarkupAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#6B6560]">Overhead ({quote.overheadPct}%)</span>
              <span className="text-[#3A3530] tabular-nums">${fmt(totals.overheadAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#6B6560]">Profit ({quote.profitPct}%)</span>
              <span className="text-[#3A3530] tabular-nums">${fmt(totals.profitAmount)}</span>
            </div>
          </div>
          <div className="border-t-2 border-[#C17F3A] bg-[#1E2A38] px-5 py-4 flex justify-between items-center">
            <span className="text-white/70 text-sm font-medium uppercase tracking-wider">
              Total Investment
            </span>
            <span className="text-white text-xl font-bold tabular-nums">
              ${fmt(totals.total)}
            </span>
          </div>
        </div>

        {/* Project Timeline — Bar Chart */}
        {quote.milestones.length > 0 && (
          <div className="mb-10 print:mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
              <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Project Timeline</h3>
            </div>

            <div className="bg-white rounded border border-[#E8E4DD] p-5 print:p-3">
              {/* Week header row */}
              <div className="flex mb-1" style={{ paddingLeft: "140px" }}>
                {Array.from({ length: maxWeek + 1 }, (_, wk) => (
                  <div key={wk} className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-[#6B6560]">WK {wk}</div>
                    <div className="text-[9px] text-[#9A9591]">{weekDate(wk)}</div>
                  </div>
                ))}
              </div>

              {/* Phase bars */}
              <div className="flex flex-col gap-1.5 mt-2">
                {(() => {
                  const phases = quote.milestones.filter((m) => m.position > 0);
                  const totalWeeks = maxWeek + 1;
                  // Calculate cumulative start positions so bars butt up against each other
                  let cursor = 0;
                  const bars = phases.map((m) => {
                    const widthWeeks = Math.max(durationToWeeks(m.duration), 0.3);
                    const startPct = (cursor / totalWeeks) * 100;
                    const widthPct = (widthWeeks / totalWeeks) * 100;
                    cursor += widthWeeks;
                    return { ...m, startPct, widthPct };
                  });
                  return bars.map((m) => {
                  const hasPayment = m.paymentPct != null && m.paymentPct > 0;

                  return (
                    <div key={m.id} className="flex items-center">
                      <div className="w-[140px] shrink-0 pr-3 text-right">
                        <span className="text-xs text-[#3A3530] font-medium">{m.name}</span>
                      </div>
                      <div className="flex-1 relative h-7">
                        {/* Background grid lines */}
                        <div className="absolute inset-0 flex">
                          {Array.from({ length: totalWeeks }, (_, wk) => (
                            <div key={wk} className="flex-1 border-l border-[#F0EDE8]" />
                          ))}
                        </div>
                        {/* Phase bar */}
                        <div
                          className="absolute top-0.5 h-6 rounded"
                          style={{
                            left: `${m.startPct}%`,
                            width: `${Math.min(m.widthPct, 100 - m.startPct)}%`,
                            backgroundColor: "#1E2A38",
                            borderLeft: hasPayment ? "3px solid #C17F3A" : undefined,
                          }}
                        >
                          {m.duration && (
                            <span className="text-[9px] text-white/70 px-2 leading-6 whitespace-nowrap">
                              {m.duration}
                            </span>
                          )}
                        </div>
                        {/* Payment diamond marker */}
                        {hasPayment && (
                          <div
                            className="absolute w-2.5 h-2.5 bg-[#C17F3A] rotate-45"
                            style={{ left: `calc(${m.startPct}% - 5px)`, top: "-4px" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                });
                })()}
              </div>

              <p className="text-[10px] text-[#9A9591] mt-4 italic">
                Timeline assumes project start of {weekDate(0)}. Actual dates may vary based on material availability and scheduling.
              </p>
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        {schedule.length > 0 && (
          <div className="mb-10 print:mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
              <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Payment Schedule</h3>
            </div>

            <div className="bg-white rounded border border-[#E8E4DD] overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-[#F7F5F0] text-[10px] font-bold text-[#6B6560] uppercase tracking-wider border-b border-[#E8E4DD]">
                <span className="col-span-4">Milestone</span>
                <span className="col-span-2 text-center">Week</span>
                <span className="col-span-2 text-right">Payment</span>
                <span className="col-span-2 text-right">Amount</span>
                <span className="col-span-2 text-right">Balance</span>
              </div>

              {schedule.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-12 gap-2 px-5 py-2.5 text-sm ${
                    i % 2 === 0 ? "bg-white" : "bg-[#FAFAF7]"
                  } ${i > 0 ? "border-t border-[#F0EDE8]" : ""}`}
                >
                  <div className="col-span-4">
                    <span className="text-[#3A3530] font-medium">{row.name}</span>
                    {row.paymentLabel && (
                      <span className="text-[#9A9591] text-xs ml-1.5">({row.paymentLabel})</span>
                    )}
                  </div>
                  <span className="col-span-2 text-center text-[#6B6560]">{row.weekNumber}</span>
                  <span className="col-span-2 text-right text-[#6B6560]">{row.paymentPct}%</span>
                  <span className="col-span-2 text-right text-[#1A1917] font-semibold tabular-nums">
                    ${fmt(row.amount)}
                  </span>
                  <span className="col-span-2 text-right text-[#6B6560] tabular-nums">
                    ${fmt(row.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Terms */}
        <div className="mb-8 print:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
            <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Payment Terms</h3>
          </div>
          <p className="text-sm text-[#4A4540] leading-relaxed pl-3 border-l-2 border-[#E8E4DD]">
            {quote.paymentTerms}
          </p>
        </div>

        {/* Exclusions */}
        <div className="mb-8 print:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
            <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Exclusions</h3>
          </div>
          <div className="bg-[#F0EDE8] rounded px-4 py-3 text-sm text-[#4A4540] leading-relaxed">
            {quote.exclusions}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mb-12 print:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-[#C17F3A] rounded-full" />
            <h3 className="text-sm font-bold text-[#1A1917] uppercase tracking-wider">Terms &amp; Conditions</h3>
          </div>
          <div className="text-xs text-[#6B6560] space-y-1.5 leading-relaxed">
            <p><span className="font-semibold text-[#4A4540]">A.</span> Interest of 2% per month will be added on all overdue accounts beginning on the day of delinquency.</p>
            <p><span className="font-semibold text-[#4A4540]">B.</span> Any alteration or deviation from the above specifications requiring extra cost will become an extra charge via written change order.</p>
            <p><span className="font-semibold text-[#4A4540]">C.</span> All agreements contingent upon strikes, accidents, or delays beyond our control including material availability and pricing changes.</p>
            <p><span className="font-semibold text-[#4A4540]">D.</span> Warranty void by earthquake, tornado, or other act of God, or by non-payment. Warranty coverage begins at time of final payment.</p>
            <p><span className="font-semibold text-[#4A4540]">E.</span> This proposal does not include labor or material for unforeseen conditions. Additional repair fees will be added via change order.</p>
            <p><span className="font-semibold text-[#4A4540]">F.</span> Payment due within thirty days of date of invoice (net 30).</p>
          </div>
        </div>

        {/* Acceptance */}
        <AcceptanceBlock
          slug={quote.slug}
          token={quote.signingToken ?? undefined}
          accepted={!!quote.acceptance}
          signerName={quote.acceptance?.signerName}
          acceptedAt={quote.acceptance?.acceptedAt?.toString()}
        />

        {/* Footer */}
        <div className="mt-12 mb-8 pt-6 border-t border-[#DDD8D0] flex items-center justify-between print:mt-6">
          <div>
            <p className="text-xs font-bold text-[#1A1917] tracking-wide">Building NV</p>
            <p className="text-[11px] text-[#9A9591]">NV License #0092515</p>
          </div>
          <p className="text-[11px] text-[#9A9591]">
            buildingnv.us
          </p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
