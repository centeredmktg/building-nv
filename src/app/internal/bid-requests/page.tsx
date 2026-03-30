import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTradeLabel } from "@/lib/trades";
import type { TradeId } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function BidRequestsPage() {
  const bidRequests = await prisma.bidRequest.findMany({
    include: {
      invitations: {
        select: { id: true, response: { select: { id: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Bid Requests</h1>
        <Link
          href="/internal/bid-requests/new"
          className="bg-brand text-white px-4 py-2 rounded-sm text-sm hover:bg-brand/90 transition-colors"
        >
          + New Bid Request
        </Link>
      </div>

      {bidRequests.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="mb-2">No bid requests yet.</p>
          <Link href="/internal/bid-requests/new" className="text-brand hover:underline">
            Create your first bid request
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Trade</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Location</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Project Type</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Deadline</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Invited / Responded</th>
              </tr>
            </thead>
            <tbody>
              {bidRequests.map((br) => (
                <tr key={br.id} className="border-b border-border last:border-b-0 hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <Link href={`/internal/bid-requests/${br.id}`} className="text-brand hover:underline font-medium">
                      {getTradeLabel(br.requiredTrade as TradeId)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{br.generalLocation}</td>
                  <td className="px-4 py-3 text-text-muted">{br.projectType}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(br.responseDeadline).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(br.status)}`}>
                      {br.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {br.invitations.length} / {br.invitations.filter((i) => i.response).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
