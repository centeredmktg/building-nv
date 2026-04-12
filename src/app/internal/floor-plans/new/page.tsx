import { prisma } from "@/lib/prisma";
import NewFloorPlanForm from "./NewFloorPlanForm";

export const dynamic = "force-dynamic";

export default async function NewFloorPlanPage() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-8">New Floor Plan</h1>
      <NewFloorPlanForm projects={projects} />
    </div>
  );
}
