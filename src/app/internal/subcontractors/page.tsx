import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTradeLabel } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function SubcontractorsPage() {
  const subs = await prisma.subcontractorProfile.findMany({
    include: {
      company: {
        include: {
          subcontractorReviews: {
            select: { timeliness: true, communication: true, price: true, qualityOfWork: true, wouldRehire: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "text-green-700 bg-green-50";
      case "suspended": return "text-red-700 bg-red-50";
      case "pending": return "text-yellow-700 bg-yellow-50";
      default: return "text-text-muted bg-surface";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Subcontractors</h1>
        <Link
          href="/internal/subcontractors/new"
          className="bg-brand text-white px-4 py-2 rounded-sm text-sm hover:bg-brand/90 transition-colors"
        >
          + Add Subcontractor
        </Link>
      </div>

      {subs.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="mb-2">No subcontractors yet.</p>
          <Link href="/internal/subcontractors/new" className="text-brand hover:underline">
            Add your first subcontractor
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Company</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Trades</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">License</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Bid Limit</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-text-muted">Jobs / Avg</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((sub) => {
                const reviews = sub.company.subcontractorReviews;
                const count = reviews.length;
                const avgAll = count > 0
                  ? (reviews.reduce((s, r) => s + r.timeliness + r.communication + r.price + r.qualityOfWork, 0) / (count * 4)).toFixed(1)
                  : "—";

                return (
                  <tr key={sub.id} className="border-b border-border last:border-b-0 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link href={`/internal/subcontractors/${sub.id}`} className="text-brand hover:underline font-medium">
                        {sub.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {sub.trades.map((t) => getTradeLabel(t as Parameters<typeof getTradeLabel>[0])).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{sub.licenseNumber || "—"}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {sub.bidLimit ? `$${sub.bidLimit.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(sub.onboardingStatus)}`}>
                        {sub.onboardingStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {count} / {avgAll}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
