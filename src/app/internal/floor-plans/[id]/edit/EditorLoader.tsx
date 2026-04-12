"use client";

import dynamic from "next/dynamic";
import type { CanvasData } from "@/lib/floor-plan-types";

const FloorPlanEditor = dynamic(() => import("./FloorPlanEditor"), { ssr: false });

interface Props {
  floorPlanId: string;
  initialName: string;
  projectName: string | null;
  initialCanvasData: CanvasData;
  sourceImageUrl: string | null;
  extractionNotes: string[];
}

export default function EditorLoader(props: Props) {
  return <FloorPlanEditor {...props} />;
}
