# Pascal Viewer Integration (v1) — Design Spec

**Date:** 2026-04-20
**Status:** Draft

## Purpose

Bring [pascalorg/editor](https://github.com/pascalorg/editor) — a 3D building viewer/editor built on React Three Fiber — into the buildingnv app so Building NV can offer full design-build projects with real 3D deliverables, not just PDFs.

**Long-term north star:** a phased workflow where estimators sketch simple 2D floor plans in the existing Konva canvas to support a quote, and those sketches auto-extrude into a Pascal scene that Pascal's `<Viewer />` renders as the design-phase 3D deliverable.

**Architectural fit:** In that north-star workflow, *editing happens in the 2D canvas*. Pascal's job is to render the extruded result. That makes Pascal's published **viewer** (not its unpublished editor app) the right primitive. v1 validates the viewer works inside Next.js 16.

**This v1 is deliberately narrow:** install the published npm packages, mount `<Viewer />` at an authenticated route with a hardcoded demo scene, confirm the stack builds and renders cleanly.

## Scope — v1 only

**In:**
- Install `@pascal-app/core` and `@pascal-app/viewer` (both 0.5.1) plus required peer deps
- New route `/internal/pascal` behind the existing `/internal` auth gate
- Nested layout that overrides the parent's `max-w-7xl` wrapper so the viewer can use the full viewport
- Client-only mount via `next/dynamic` with `ssr: false`
- A small hardcoded demo scene (one building, one level, a couple of zones) constructed via `@pascal-app/core`'s scene schema, so there's something to render
- One nav entry in `InternalNav` labeled "3D Viewer (Beta)"

**Out (explicitly deferred):**
- Any Prisma schema changes or Postgres scene storage
- Project / proposal / job linkage
- Konva 2D → Pascal scene extrude bridge (the north-star workflow)
- Any editor chrome (toolbars, click-to-add-wall, property panels) — those live in Pascal's unpublished `apps/editor` and are not copied over in v1
- Scene sharing, export, or client-facing viewing
- Role-based access (all `/internal` users can open the route)
- Pascal source modifications or forking
- Bundle size optimization beyond what `next/dynamic` already gives us

## Users

All authenticated users with access to `/internal`. No new roles in v1.

## Architecture

### Integration model

Pascal is consumed as a **library**, not forked or vendored. The published npm packages (`@pascal-app/core`, `@pascal-app/viewer`) are installed as normal dependencies. Only the viewer is published — the editor UI from Pascal's `apps/editor` is deliberately left behind because our long-term workflow does its editing in the 2D canvas.

### File layout

```
src/app/internal/pascal/
  layout.tsx        // Overrides parent max-w-7xl wrapper; full viewport
  page.tsx          // Server component shell; dynamically imports PascalViewer (ssr: false)
  PascalViewer.tsx  // Client component: mounts <Viewer /> with the demo scene
  demo-scene.ts     // Small hardcoded scene data (one building, one level, zones)
```

### Rendering + SSR

Pascal depends on `three`, `@react-three/fiber`, `@react-three/drei`, and `idb-keyval` — all browser-only. The route must never run on the server. Pattern:

```tsx
// page.tsx
import dynamic from "next/dynamic";

const PascalViewer = dynamic(() => import("./PascalViewer"), { ssr: false });

export default function PascalPage() {
  return <PascalViewer />;
}
```

This keeps Pascal's dependency payload out of every other page's bundle.

### What `<Viewer />` actually needs

`@pascal-app/viewer` exports `Viewer` (the renderer), `WalkthroughControls` (first-person navigation), `useViewer` (a Zustand store for selection/camera/level-display state), plus material helpers and layer constants. Scene data (buildings, levels, zones) is constructed via `@pascal-app/core`'s schema. v1's `demo-scene.ts` will hardcode a minimal valid scene using that schema.

### Dependencies

Added to `package.json`:

| Package | Version | Role |
|---|---|---|
| `@pascal-app/core` | `0.5.1` (pinned) | Scene schema, Zustand scene store |
| `@pascal-app/viewer` | `0.5.1` (pinned) | `<Viewer />` component, walkthrough controls |
| `@react-three/fiber` | `^9` | R3F renderer (Pascal peer dep) |
| `@react-three/drei` | `^10` | R3F helpers (Pascal peer dep) |
| `three` | `0.183.x` | WebGL/WebGPU 3D lib (Pascal peer dep) |

Pin Pascal packages exactly since they're 0.5.x and APIs may churn.

### Auth

Inherited from `src/app/internal/layout.tsx` — it calls `getServerSession` and redirects to `/login` if absent. No new auth logic.

### Persistence

None. v1 renders a hardcoded demo scene. Pascal's own Zustand/IndexedDB machinery exists but we don't wire it to any buildingnv data. v2 will address scene persistence in Postgres when the 2D→3D pipeline lands.

## Data flow

None crosses the app boundary in v1. Scene is static module-level data imported into a React component.

## Error handling

- **Pascal package fails to load:** `next/dynamic` surfaces a loading boundary; show a simple "3D viewer failed to load — try refreshing" fallback.
- **WebGL/WebGPU unsupported in browser:** Pascal's viewer will throw on mount in ancient browsers. Wrap `<Viewer />` in an error boundary that shows a compatibility notice.
- **Scene schema mismatch:** If a future Pascal release changes the scene schema, the demo scene will break at runtime. Acceptable risk — we pin versions.

## Testing

- **Manual smoke test:** navigate to `/internal/pascal` logged in, confirm the viewer renders the demo scene, walkthrough controls work, no console errors.
- **Build test:** `npm run build` must succeed — this catches SSR leaks.
- **No new unit tests in v1.** The surface area we own is trivial (a route shell, a dynamic import, static demo data).

## Risks & open questions

- **Pascal is 0.5.x.** API and schema may change. Mitigation: pin exact versions; revisit on each Pascal release.
- **Peer dep drift.** `@pascal-app/core` 0.5.1 declares `three ^0.182`; `@pascal-app/viewer` 0.5.1 on npm declares `three ^0.183`. These ranges do not overlap — installing `three@0.183.x` satisfies the viewer but npm will emit a peer warning on core. Accept the warning; three.js minor versions are backward-compatible in practice.
- **Bundle size on the Pascal route.** Three.js + R3F + Drei is a heavy payload. Internal-only route in v1, so not a concern yet. Will need attention if Pascal ever ships client-facing.
- **Demo scene authoring.** We have to construct a valid scene by hand from the `@pascal-app/core` schema. The implementation plan should allocate time to read the schema and confirm the demo scene validates.

## Next spec (v2 — not this document)

Once v1 is running, the next spec will cover: Konva 2D sketch surface → Pascal scene construction (programmatic wall extrusion) → Postgres scene persistence linked to a project → `<Viewer />` rendering the scene as a read-only deliverable. That spec will also decide whether designers get any interactive editing on the 3D side or whether all edits route back through the 2D surface.
