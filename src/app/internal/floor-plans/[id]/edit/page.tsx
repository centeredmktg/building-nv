import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditorLoader from "./EditorLoader";
import type { CanvasData } from "@/lib/floor-plan-types";

export const dynamic = "force-dynamic";

export default async function FloorPlanEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { id },
    include: { project: { select: { name: true } } },
  });

  if (!floorPlan) notFound();

  const canvasData = floorPlan.canvasData as unknown as CanvasData;

  return (
    <div className="-mx-6 -mt-10">
      <EditorLoader
        floorPlanId={floorPlan.id}
        initialName={floorPlan.name}
        projectName={floorPlan.project?.name ?? null}
        initialCanvasData={canvasData}
        sourceImageUrl={floorPlan.sourceImageUrl}
        extractionNotes={[]}
      />
    </div>
  );
}
