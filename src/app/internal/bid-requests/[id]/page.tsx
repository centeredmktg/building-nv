import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTradeLabel } from "@/lib/trades";
import type { TradeId } from "@/lib/trades";
import AwardButton from "./AwardButton";

export const dynamic = "force-dynamic";

export default async function BidRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const br = await prisma.bidRequest.findUnique({
    where: { id },
    include: {
      quote: { select: { id: true, slug: true, title: true } },
      invitations: {
        include: {
          subcontractor: {
            select: {
              id: true,
              name: true,
              subcontractorProfile: { select: { licenseNumber: true, bidLimit: true } },
            },
          },
          response: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!br) notFound();

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "text-text-muted bg-surface";
      case "sent": return "text-blue-700 bg-blue-50";
      case "responses_received": return "text-yellow-700 bg-yellow-50";
      case "awarded": return "text-green-700 bg-green-50";
      case "cancelled": return "text-red-700 bg-red-50";
      default: return "text-text-muted bg-surface";
    }
  };

  const responseStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "text-green-700 bg-green-50";
      case "rejected": return "text-red-700 bg-red-50";
      case "under_review": return "text-yellow-700 bg-yellow-50";
      default: return "text-text-muted bg-surface";
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {getTradeLabel(br.requiredTrade as TradeId)} Bid Request
          </h1>
          <p className="text-text-muted text-sm mt-1">
            {br.projectType} — {br.generalLocation}
          </p>
        </div>
        <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${statusColor(br.status)}`}>
          {br.status.replace(/_/g, " ")}
        </span>
      </div>

      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Scope of Work</h2>
        <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans">{br.scopeOfWork}</pre>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">Response Deadline:</span>{" "}
            <span className="text-text-primary">{new Date(br.responseDeadline).toLocaleDateString()}</span>
          </div>
          {br.startWindow && (
            <div>
              <span className="text-text-muted">Start Window:</span>{" "}
              <span className="text-text-primary">{br.startWindow}</span>
            </div>
          )}
          {br.specialRequirements && (
            <div className="col-span-2">
              <span className="text-text-muted">Special Requirements:</span>{" "}
              <span className="text-text-primary">{br.specialRequirements}</span>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-text-muted">
          Source: <Link href={`/internal/quotes/${br.quote.id}/edit`} className="text-brand hover:underline">{br.quote.title}</Link>
        </div>
      </section>

      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Invitations ({br.invitations.length})
        </h2>
        {br.invitations.length === 0 ? (
          <p className="text-text-muted text-sm">No subcontractors invited yet.</p>
        ) : (
          <div className="space-y-4">
            {br.invitations.map((inv) => (
              <div key={inv.id} className="border border-border rounded-sm p-4">
                <div className="flex items-center justify-between">
                  <span className="text-brand font-medium text-sm">
                    {inv.subcontractor.name}
                  </span>
                  <span className="text-xs text-text-muted">{inv.status}</span>
                </div>
                {inv.response ? (
                  <div className="mt-3 bg-surface rounded-sm p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-text-primary">
                        ${inv.response.amount.toLocaleString()}
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${responseStatusColor(inv.response.status)}`}>
                        {inv.response.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {inv.response.estimatedDuration && (
                      <div className="text-xs text-text-muted mt-1">Duration: {inv.response.estimatedDuration}</div>
                    )}
                    {inv.response.availableStartDate && (
                      <div className="text-xs text-text-muted">Available: {new Date(inv.response.availableStartDate).toLocaleDateString()}</div>
                    )}
                    {inv.response.scopeNotes && (
                      <div className="text-sm text-text-primary mt-2">{inv.response.scopeNotes}</div>
                    )}
                    {inv.response.status === "submitted" && br.status !== "awarded" && (
                      <AwardButton bidRequestId={br.id} responseId={inv.response.id} invitationId={inv.id} subName={inv.subcontractor.name} />
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-text-muted">Awaiting response</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
