import NewComponentForm from "./NewComponentForm";
import { prisma } from "@/lib/prisma";

export default async function NewComponentPage() {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-text-primary mb-8">Add Component</h1>
      <NewComponentForm vendors={vendors} />
    </div>
  );
}
