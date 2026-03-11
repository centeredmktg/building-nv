import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { components: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Vendors</h1>
        <Link
          href="/internal/vendors/new"
          className="bg-accent text-bg font-semibold px-5 py-2.5 rounded-sm text-sm hover:bg-accent/90 transition-colors"
        >
          Add Vendor
        </Link>
      </div>

      {vendors.length === 0 ? (
        <div className="border border-border rounded-sm p-12 text-center">
          <p className="text-text-muted mb-4">No vendors yet.</p>
          <Link href="/internal/vendors/new" className="text-accent text-sm hover:underline">
            Add your first vendor
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-sm divide-y divide-border">
          {vendors.map((v) => (
            <div key={v.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-text-primary font-medium">{v.name}</p>
                {v.website && (
                  <a
                    href={v.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent text-sm hover:underline"
                  >
                    {v.website}
                  </a>
                )}
              </div>
              <p className="text-text-muted text-sm">
                {v._count.components} component{v._count.components !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
