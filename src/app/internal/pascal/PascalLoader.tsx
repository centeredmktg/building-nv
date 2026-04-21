"use client";

// Why this file exists: Next.js 16 forbids `dynamic({ ssr: false })` inside
// Server Components, so the dynamic import lives here in a client shell that
// page.tsx (a Server Component) renders.

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
