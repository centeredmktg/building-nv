import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const postings = await prisma.jobPosting.findMany({
    include: { _count: { select: { applications: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Job Postings</h1>
        <Link
          href="/internal/careers/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Posting
        </Link>
      </div>

      {postings.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No job postings yet.</p>
          <Link href="/internal/careers/new" className="text-accent text-sm hover:underline">
            Create your first posting
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {postings.map((posting) => (
            <Link
              key={posting.id}
              href={`/internal/careers/${posting.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-surface/50 transition-colors"
            >
              <div>
                <p className="text-text-primary font-medium">{posting.title}</p>
                <p className="text-text-muted text-sm mt-0.5">
                  {posting.location} · {posting.type}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-text-muted text-sm">
                  {posting._count.applications} applicant{posting._count.applications !== 1 ? "s" : ""}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-sm ${
                    posting.status === "open"
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {posting.status === "open" ? "Open" : "Closed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
