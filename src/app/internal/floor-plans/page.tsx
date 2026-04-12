import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FloorPlansPage() {
  const floorPlans = await prisma.floorPlan.findMany({
    include: { project: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Floor Plans</h1>
          <p className="text-text-muted text-sm mt-1">
            Scan hand-drawn sketches and convert to clean digital floor plans.
          </p>
        </div>
        <Link
          href="/internal/floor-plans/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          New Floor Plan
        </Link>
      </div>

      {floorPlans.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No floor plans yet.</p>
          <Link href="/internal/floor-plans/new" className="text-accent text-sm hover:underline">
            Upload your first scan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {floorPlans.map((fp) => (
            <Link
              key={fp.id}
              href={`/internal/floor-plans/${fp.id}/edit`}
              className="border border-border rounded-sm overflow-hidden hover:border-accent/50 transition-colors group"
            >
              <div className="aspect-[4/3] bg-surface flex items-center justify-center">
                {fp.thumbnailUrl ? (
                  <img
                    src={fp.thumbnailUrl}
                    alt={fp.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-text-muted text-sm">No preview</span>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-text-primary font-medium text-sm group-hover:text-accent transition-colors">
                  {fp.name}
                </h3>
                {fp.project && (
                  <p className="text-text-muted text-xs mt-1">{fp.project.name}</p>
                )}
                <p className="text-text-muted text-xs mt-1">
                  {fp.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
