# Pascal Viewer Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount Pascal's published `<Viewer />` at `/internal/pascal` inside buildingnv, rendering a small hardcoded scene, behind the existing `/internal` auth gate.

**Architecture:** Consume `@pascal-app/core` and `@pascal-app/viewer` as npm dependencies. Client-only route via `next/dynamic` with `ssr: false`. No Prisma, no domain linkage. Pascal's own Zustand + IndexedDB handles scene state; we seed a minimal scene at mount time if the schema permits, otherwise ship an empty viewer and defer scene seeding to a later increment.

**Tech Stack:** Next.js 16 (App Router), React 19, `@pascal-app/core@0.5.1`, `@pascal-app/viewer@0.5.1`, `@react-three/fiber@^9`, `@react-three/drei@^10`, `three@^0.183`.

**Spec:** `docs/superpowers/specs/2026-04-20-pascal-editor-integration-design.md`

---

## File Structure

Files this plan will create or modify:

| File | Purpose |
|---|---|
| `package.json` | Add Pascal + peer deps |
| `src/app/internal/pascal/layout.tsx` | Full-viewport layout override (bypasses parent `max-w-7xl` wrapper) |
| `src/app/internal/pascal/page.tsx` | Server component shell; dynamically imports viewer client component |
| `src/app/internal/pascal/PascalViewer.tsx` | Client component that mounts R3F `<Canvas>` + Pascal `<Viewer />` |
| `src/app/internal/pascal/demo-scene.ts` | Static demo scene data (added in Task 6 if schema is tractable) |
| `src/components/internal/InternalNav.tsx` | Add one nav link pointing at `/internal/pascal` |

Pascal's `<Viewer />` must be rendered inside an R3F `<Canvas>` — it is a scene component, not a standalone DOM element. `PascalViewer.tsx` owns that wrapper.

---

## Task 1: Install Pascal + R3F dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the packages**

Run from repo root. Two commands — Pascal packages pinned exactly (0.5.x may churn), peers at caret ranges:

```bash
npm install --save-exact @pascal-app/core@0.5.1 @pascal-app/viewer@0.5.1
npm install @react-three/fiber@^9 @react-three/drei@^10 three@^0.183
```

Expect npm to emit a peer-dep warning because `@pascal-app/core@0.5.1` declares `three ^0.182` and we installed `0.183.x`. This is acknowledged in the spec; three.js minor versions are backward-compatible. Do not try to install both three versions.

After both commands, verify `package.json` shows `@pascal-app/core` and `@pascal-app/viewer` without a caret (`"@pascal-app/core": "0.5.1"`, not `"^0.5.1"`), and the three R3F/three deps with a caret.

- [ ] **Step 2: Verify versions landed correctly**

Run:

```bash
npm ls @pascal-app/core @pascal-app/viewer @react-three/fiber @react-three/drei three
```

Expected: each package appears once, at the expected version. If `three` appears twice (duplicated by some other dependency), run `npm dedupe` and re-check.

- [ ] **Step 3: Verify the app still builds with the new deps**

Run:

```bash
npm run build
```

Expected: build completes successfully. (No new routes yet — we're just confirming the new packages don't break the existing build.) If build fails, stop and investigate before proceeding; do not commit a broken build.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Pascal viewer + R3F dependencies"
```

---

## Task 2: Full-viewport layout for /internal/pascal

The parent `src/app/internal/layout.tsx` wraps children in `<main className="max-w-7xl mx-auto px-6 py-10">`. A 3D viewer squeezed into 1280px with padding will look broken. We need a nested layout that replaces that wrapper with a full-bleed container, while keeping the `<InternalNav />` and auth check from the parent.

**Note:** Next.js nested layouts *wrap* parent layouts; they don't replace them. So we cannot simply opt out of the parent's `<main>`. Instead, this nested layout just renders children directly (inheriting parent's `<main>`) and we use CSS to break out. Specifically: the child uses `fixed` positioning + viewport-sized dimensions to escape the parent container.

**Files:**
- Create: `src/app/internal/pascal/layout.tsx`

- [ ] **Step 1: Create the nested layout**

Create `src/app/internal/pascal/layout.tsx`:

```tsx
export default function PascalLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 top-[65px] bg-bg">{children}</div>;
}
```

`top-[65px]` leaves room for `InternalNav` (which is `px-6 py-4` with `text-sm` + borders — roughly 65px tall). `fixed inset-0` escapes the parent's `max-w-7xl` container. Auth and nav still come from the parent `internal/layout.tsx`.

- [ ] **Step 2: Commit (route not wired yet; commit is a checkpoint)**

```bash
git add src/app/internal/pascal/layout.tsx
git commit -m "feat(pascal): add full-viewport layout for 3D route"
```

---

## Task 3: Build the client-only PascalViewer component

`<Viewer />` renders into an R3F `<Canvas>`. This component owns both.

**Files:**
- Create: `src/app/internal/pascal/PascalViewer.tsx`

- [ ] **Step 1: Create the client component**

Create `src/app/internal/pascal/PascalViewer.tsx`:

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Viewer } from "@pascal-app/viewer";

export default function PascalViewer() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Viewer />
      </Canvas>
    </div>
  );
}
```

**Why these values:**
- `position={[10, 10, 10]}` is a reasonable starting camera for an empty-or-small scene — looks at origin from a diagonal angle in meters. Pascal scenes are metric.
- `fov: 50` matches R3F's default perspective camera.
- `shadows` is on; Pascal's materials expect lighting.
- `ambientLight` + `directionalLight` give a baseline so scenes aren't pitch-black. Pascal's `<Viewer />` may add its own lighting — if so, we can remove these later.

- [ ] **Step 2: Commit**

```bash
git add src/app/internal/pascal/PascalViewer.tsx
git commit -m "feat(pascal): add PascalViewer client component"
```

---

## Task 4: Wire the server-side page with dynamic import

**Files:**
- Create: `src/app/internal/pascal/page.tsx`

- [ ] **Step 1: Create the route page**

Create `src/app/internal/pascal/page.tsx`:

```tsx
import dynamic from "next/dynamic";

const PascalViewer = dynamic(() => import("./PascalViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-text-muted">
      Loading 3D viewer…
    </div>
  ),
});

export default function PascalPage() {
  return <PascalViewer />;
}
```

`ssr: false` is mandatory — Pascal depends on `idb-keyval` (browser-only) and three.js (WebGL). Without this flag, `next build` will attempt to pre-render the route and crash.

- [ ] **Step 2: Verify the build succeeds with the new route**

Run:

```bash
npm run build
```

Expected: build completes without errors. Specifically, there must be no "ReferenceError: window is not defined" or "IDBFactory is not defined" — those would indicate the dynamic import didn't actually skip SSR.

- [ ] **Step 3: Commit**

```bash
git add src/app/internal/pascal/page.tsx
git commit -m "feat(pascal): mount Pascal viewer at /internal/pascal"
```

---

## Task 5: Manual smoke test in dev

No unit test covers a third-party 3D renderer's mount behavior. A manual smoke test is the right verification.

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected: dev server starts on http://localhost:3000.

- [ ] **Step 2: Navigate and confirm**

In a browser:
1. Log in via `/login` if not already.
2. Navigate to `http://localhost:3000/internal/pascal`.

Confirm each:
- Page loads (no 404, no error boundary).
- 3D canvas renders (you see a dark/empty 3D viewport — empty is expected since we haven't seeded a scene).
- Browser devtools **Console** tab has no red errors. Yellow peer-dep warnings from npm are fine; runtime errors from Pascal/R3F are not.
- Browser devtools **Network** tab shows no 404s.

- [ ] **Step 3: Stop the dev server**

Ctrl+C. No commit — nothing changed.

**If any of the above fails:** do not proceed to Task 6. Diagnose and fix (likely an SSR leak, a missing peer dep, or a WebGL init issue) and re-run the smoke test.

---

## Task 6: Seed a minimal demo scene (stretch — scope-gated)

The spec calls for a "small hardcoded demo scene (one building, one level, a couple of zones)." Pascal's scene schema is non-trivial and the implementor should read it before committing to a shape.

**Scope gate:** If reading the schema and constructing a valid building + level + wall takes more than **45 minutes of focused work**, stop. Ship v1 with an empty viewer and open a follow-up issue to seed a scene in v1.1. An empty viewer that *renders* is a legitimate v1; a broken or half-seeded scene is not.

**Files (if proceeding):**
- Create: `src/app/internal/pascal/demo-scene.ts`
- Modify: `src/app/internal/pascal/PascalViewer.tsx`

- [ ] **Step 1: Read Pascal's scene API**

Read (via GitHub or node_modules):
- `@pascal-app/core`'s `useScene` store exports — look at the store shape and its `addBuilding` / `addLevel` / `addWall` actions (names approximate; verify in source).
- `@pascal-app/core/src/schema/` directory for the building/level/wall zod schemas.

Goal: identify the minimum calls needed to get one building → one level → one closed zone (e.g., four walls forming a room) into the store.

- [ ] **Step 2: Write a schema-validation test for `demo-scene.ts`**

Create `src/app/internal/pascal/__tests__/demo-scene.test.ts`:

```ts
import { describe, it, expect } from "@jest/globals";
import { seedDemoScene } from "../demo-scene";
import { useScene } from "@pascal-app/core";

describe("demo-scene", () => {
  it("seeds a valid building + level + zone into the scene store", () => {
    const before = Object.keys(useScene.getState().nodes).length;
    seedDemoScene();
    const after = Object.keys(useScene.getState().nodes).length;
    expect(after).toBeGreaterThan(before);
  });
});
```

This test is intentionally loose — it asserts the seed *adds nodes*, not the exact count, because the seed function may add more than one node per zone (walls, slab, etc.) depending on schema.

Run:

```bash
npm test -- demo-scene.test.ts
```

Expected: FAIL with "Cannot find module '../demo-scene'" (file doesn't exist yet).

- [ ] **Step 3: Implement `demo-scene.ts`**

Create `src/app/internal/pascal/demo-scene.ts`. The exact code depends on Pascal's actual API (read in Step 1). Sketch (replace with real calls after reading source):

```ts
import { useScene } from "@pascal-app/core";

export function seedDemoScene() {
  const state = useScene.getState();
  // Replace the below with actual Pascal store actions after reading source.
  // Expected API shape (verify): addBuilding({ name }) -> id,
  // addLevel({ buildingId, elevation }) -> id,
  // addWall({ levelId, start, end, height, thickness }) -> id
  // Seed one building, one level, four walls forming a 4m x 4m square at origin.
}
```

**Important:** if, after reading the source, the API is not this shape, update this function accordingly. Do not ship the placeholder.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- demo-scene.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire the seed into `PascalViewer.tsx`**

Modify `src/app/internal/pascal/PascalViewer.tsx` — add a `useEffect` that seeds once on mount:

```tsx
"use client";

import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Viewer } from "@pascal-app/viewer";
import { useScene } from "@pascal-app/core";
import { seedDemoScene } from "./demo-scene";

export default function PascalViewer() {
  useEffect(() => {
    // Seed only if the user's persisted scene is empty, so we don't
    // clobber work across reloads.
    if (Object.keys(useScene.getState().nodes).length === 0) {
      seedDemoScene();
    }
  }, []);

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [10, 10, 10], fov: 50 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <Viewer />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 6: Re-run the smoke test**

```bash
npm run dev
```

Navigate to `/internal/pascal`. Expected: 3D canvas renders a visible building/room, not an empty void. Check browser console for runtime errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/internal/pascal/demo-scene.ts \
        src/app/internal/pascal/__tests__/demo-scene.test.ts \
        src/app/internal/pascal/PascalViewer.tsx
git commit -m "feat(pascal): seed minimal demo scene on first load"
```

---

## Task 7: Add InternalNav link

Last step — make the route discoverable from the nav bar.

**Files:**
- Modify: `src/components/internal/InternalNav.tsx`

- [ ] **Step 1: Add the nav link**

In `src/components/internal/InternalNav.tsx`, add one line inside the nav links section (after the "Bids" link, before "Careers" — keeps it visually near other operational tools):

```tsx
{navLink("/internal/pascal", "3D (Beta)")}
```

Full edited section for reference — the surrounding links stay exactly as-is:

```tsx
{navLink("/internal/subcontractors", "Subs")}
{navLink("/internal/bid-requests", "Bids")}
{navLink("/internal/pascal", "3D (Beta)")}
{navLink("/internal/careers", "Careers")}
{navLink("/internal/settings/quickbooks", "Settings")}
```

- [ ] **Step 2: Smoke test the link**

```bash
npm run dev
```

Click the "3D (Beta)" link from any other `/internal/*` page. Expected: navigates to `/internal/pascal`, viewer renders.

- [ ] **Step 3: Commit**

```bash
git add src/components/internal/InternalNav.tsx
git commit -m "feat(pascal): add 3D Beta link to internal nav"
```

---

## Task 8: Final verification

- [ ] **Step 1: Production build**

```bash
npm run build
```

Expected: full build succeeds, no new warnings that weren't present before Task 1.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: clean. Fix any new lint errors in our code (not Pascal's).

- [ ] **Step 3: Test suite**

```bash
npm test
```

Expected: all existing tests still pass. The new `demo-scene.test.ts` (if Task 6 completed) passes.

- [ ] **Step 4: Final smoke**

`npm run dev`, navigate to `/internal/pascal` from a fresh browser (or incognito). Confirm end-to-end: login → internal nav → "3D (Beta)" click → viewer renders.

No commit — this is the gate before calling v1 done.

---

## What's explicitly NOT in this plan

These are v2+ concerns and must not creep into v1:

- Postgres scene persistence
- Linking scenes to projects, proposals, or jobs
- Konva 2D sketch → Pascal extrude bridge
- Editor chrome (toolbars, click-to-add, property panels)
- Role-based access beyond the existing `/internal` gate
- Scene export / client-facing viewing
- Bundle size optimization beyond `next/dynamic`

If during execution any of these feel "small to add while I'm here" — stop, push back, and defer to v2.
