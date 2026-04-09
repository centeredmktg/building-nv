import { prisma } from "@/lib/prisma";
import DetailFilters from "./DetailFilters";

export const dynamic = "force-dynamic";

export default async function DetailsPage() {
  const items = await prisma.detailLibraryItem.findMany({
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Detail Library</h1>
        <p className="text-text-muted text-sm mt-1">
          Architectural construction details from manufacturers and industry resources.
        </p>
      </div>
      <DetailFilters items={items} />
    </div>
  );
}
