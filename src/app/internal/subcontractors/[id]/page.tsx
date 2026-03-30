import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTradeLabel } from "@/lib/trades";
import type { TradeId } from "@/lib/trades";

export const dynamic = "force-dynamic";

export default async function SubcontractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sub = await prisma.subcontractorProfile.findUnique({
    where: { id },
    include: {
      company: {
        include: {
          contacts: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          contactNotes: {
            include: { contact: { select: { id: true, firstName: true, lastName: true } } },
          },
          subcontractorReviews: {
            include: { project: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          },
          bidInvitations: {
            include: {
              bidRequest: { select: { id: true, requiredTrade: true, status: true, createdAt: true, generalLocation: true } },
              response: { select: { amount: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!sub) notFound();

  const reviews = sub.company.subcontractorReviews;
  const count = reviews.length;
  const avg = (field: "timeliness" | "communication" | "price" | "qualityOfWork") =>
    count > 0 ? (reviews.reduce((s, r) => s + r[field], 0) / count).toFixed(1) : "—";
  const rehirePercent = count > 0
    ? Math.round((reviews.filter((r) => r.wouldRehire).length / count) * 100)
    : null;

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "text-green-700 bg-green-50";
      case "suspended": return "text-red-700 bg-red-50";
      case "pending": return "text-yellow-700 bg-yellow-50";
      default: return "text-text-muted bg-surface";
    }
  };

  const contactNoteMap = new Map(
    sub.company.contactNotes.map((n) => [n.contactId, n]),
  );

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{sub.company.name}</h1>
          <p className="text-text-muted text-sm mt-1">
            {sub.trades.map((t) => getTradeLabel(t as TradeId)).join(", ")}
          </p>
        </div>
        <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${statusColor(sub.onboardingStatus)}`}>
          {sub.onboardingStatus}
        </span>
      </div>

      {/* Profile Section */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">License:</span>{" "}
            <span className="text-text-primary">{sub.licenseNumber || "—"}</span>
          </div>
          <div>
            <span className="text-text-muted">Bid Limit:</span>{" "}
            <span className="text-text-primary">{sub.bidLimit ? `$${sub.bidLimit.toLocaleString()}` : "—"}</span>
          </div>
          <div>
            <span className="text-text-muted">Insurance Expiry:</span>{" "}
            <span className="text-text-primary">
              {sub.insuranceExpiry ? new Date(sub.insuranceExpiry).toLocaleDateString() : "—"}
            </span>
          </div>
          <div>
            <span className="text-text-muted">W-9 on File:</span>{" "}
            <span className="text-text-primary">{sub.w9OnFile ? "Yes" : "No"}</span>
          </div>
          {sub.company.phone && (
            <div>
              <span className="text-text-muted">Phone:</span>{" "}
              <span className="text-text-primary">{sub.company.phone}</span>
            </div>
          )}
          {sub.company.domain && (
            <div>
              <span className="text-text-muted">Website:</span>{" "}
              <span className="text-text-primary">{sub.company.domain}</span>
            </div>
          )}
        </div>
        {sub.notes && (
          <div className="mt-4 text-sm">
            <span className="text-text-muted">Notes:</span>
            <p className="text-text-primary mt-1">{sub.notes}</p>
          </div>
        )}
      </section>

      {/* Scorecard Section */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Scorecard</h2>
        {count === 0 ? (
          <p className="text-text-muted text-sm">No reviews yet — unproven subcontractor.</p>
        ) : (
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-text-primary">{avg("timeliness")}</div>
              <div className="text-xs text-text-muted">Timeliness</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{avg("communication")}</div>
              <div className="text-xs text-text-muted">Communication</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{avg("price")}</div>
              <div className="text-xs text-text-muted">Price</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{avg("qualityOfWork")}</div>
              <div className="text-xs text-text-muted">Quality</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">{rehirePercent}%</div>
              <div className="text-xs text-text-muted">Would Rehire</div>
            </div>
          </div>
        )}
        <div className="mt-2 text-xs text-text-muted text-right">{count} review{count !== 1 ? "s" : ""}</div>
      </section>

      {/* Contacts Section */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">People</h2>
        {sub.company.contacts.length === 0 ? (
          <p className="text-text-muted text-sm">No contacts linked to this company yet.</p>
        ) : (
          <div className="space-y-3">
            {sub.company.contacts.map((contact) => {
              const note = contactNoteMap.get(contact.id);
              return (
                <div key={contact.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-b-0">
                  <div>
                    <span className="text-text-primary font-medium">
                      {contact.firstName} {contact.lastName}
                    </span>
                    {contact.email && <span className="text-text-muted ml-2">{contact.email}</span>}
                    {contact.phone && <span className="text-text-muted ml-2">{contact.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {note?.preferred && (
                      <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">preferred</span>
                    )}
                    {note?.flagged && (
                      <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs">flagged</span>
                    )}
                    {note?.notes && (
                      <span className="text-text-muted text-xs italic">{note.notes}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Reviews</h2>
          <Link
            href={`/internal/subcontractors/${id}/review`}
            className="bg-brand text-white px-3 py-1.5 rounded-sm text-sm hover:bg-brand/90 transition-colors"
          >
            + Add Review
          </Link>
        </div>
        {reviews.length === 0 ? (
          <p className="text-text-muted text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-border pb-3 last:border-b-0">
                <div className="flex items-center justify-between">
                  <Link href={`/internal/jobs/${review.project.id}`} className="text-brand hover:underline text-sm font-medium">
                    {review.project.name}
                  </Link>
                  <span className="text-xs text-text-muted">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-text-muted">
                  <span>Time: {review.timeliness}/5</span>
                  <span>Comm: {review.communication}/5</span>
                  <span>Price: {review.price}/5</span>
                  <span>Quality: {review.qualityOfWork}/5</span>
                  <span className={review.wouldRehire ? "text-green-700" : "text-red-700"}>
                    {review.wouldRehire ? "Would rehire" : "Would not rehire"}
                  </span>
                </div>
                {review.notes && <p className="text-sm text-text-primary mt-1">{review.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Bid Activity */}
      <section className="border border-border rounded-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Bid Activity</h2>
        {sub.company.bidInvitations.length === 0 ? (
          <p className="text-text-muted text-sm">No bid invitations yet.</p>
        ) : (
          <div className="space-y-2">
            {sub.company.bidInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-b-0">
                <div>
                  <Link href={`/internal/bid-requests/${inv.bidRequest.id}`} className="text-brand hover:underline">
                    {getTradeLabel(inv.bidRequest.requiredTrade as TradeId)} — {inv.bidRequest.generalLocation}
                  </Link>
                  <span className="text-text-muted text-xs ml-2">
                    {new Date(inv.bidRequest.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs">
                  {inv.response ? (
                    <span className="text-text-primary">${inv.response.amount.toLocaleString()} — {inv.response.status}</span>
                  ) : (
                    <span className="text-text-muted">{inv.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
