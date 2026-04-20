"use client";

import dynamic from "next/dynamic";

const PascalViewer = dynamic(() => import("./PascalViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-text-muted">
      Loading 3D viewer…
    </div>
  ),
});

export default function PascalLoader() {
  return <PascalViewer />;
}
