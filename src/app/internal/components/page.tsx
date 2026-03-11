import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ComponentsPage() {
  const components = await prisma.component.findMany({
    include: { vendor: { select: { name: true } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const byCategory = components.reduce<Record<string, typeof components>>(
    (acc, c) => {
      const key = c.category ?? "Uncategorized";
      acc[key] = [...(acc[key] ?? []), c];
      return acc;
    },
    {}
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Component Catalog</h1>
        <Link
          href="/internal/components/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          Add Component
        </Link>
      </div>

      {components.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No components yet.</p>
          <Link href="/internal/components/new" className="text-accent text-sm hover:underline">
            Add your first component
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-3">
                {category}
              </h2>
              <div className="border border-border rounded-sm divide-y divide-border">
                {items.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 px-6 py-4"
                  >
                    <div>
                      <p className="text-text-primary font-medium">{c.name}</p>
                      <p className="text-text-muted text-sm mt-0.5">
                        {c.vendor.name}
                        {c.vendorSku ? ` · SKU: ${c.vendorSku}` : ""}
                      </p>
                    </div>
                    <p className="text-text-muted text-sm">{c.unit}</p>
                    <p className="text-text-primary font-semibold text-sm tabular-nums">
                      ${c.vendorCost.toFixed(2)}
                    </p>
                    <Link
                      href={`/internal/components/${c.id}/edit`}
                      className="text-accent text-xs hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
