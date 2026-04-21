import {
  useScene,
  BuildingNode,
  LevelNode,
  WallNode,
  ZoneNode,
} from "@pascal-app/core";

/**
 * Seeds a minimal demo scene into the Pascal scene store.
 *
 * Hierarchy: Building → Level 0 → 4 walls (10m × 8m room) + 1 zone
 *
 * Call this once when the store is empty. It is idempotent in the sense
 * that PascalViewer guards the call with a node-count check.
 */
export function seedDemoScene(): void {
  const { createNodes } = useScene.getState();

  // Room dimensions (metres, XZ plane — Pascal uses Y-up)
  const W = 10; // width  (X)
  const D = 8; // depth  (Z)

  // Parse nodes using Pascal's zod schemas so all defaults + typed IDs are applied
  const building = BuildingNode.parse({ name: "Demo Building" });
  const level = LevelNode.parse({ name: "Ground Floor", level: 0 });

  // Four walls forming a closed rectangle: NW→NE, NE→SE, SE→SW, SW→NW
  const wallN = WallNode.parse({
    name: "North Wall",
    start: [0, 0] as [number, number],
    end: [W, 0] as [number, number],
    material: { preset: "white" as const },
  });
  const wallE = WallNode.parse({
    name: "East Wall",
    start: [W, 0] as [number, number],
    end: [W, D] as [number, number],
    material: { preset: "white" as const },
  });
  const wallS = WallNode.parse({
    name: "South Wall",
    start: [W, D] as [number, number],
    end: [0, D] as [number, number],
    material: { preset: "white" as const },
  });
  const wallW = WallNode.parse({
    name: "West Wall",
    start: [0, D] as [number, number],
    end: [0, 0] as [number, number],
    material: { preset: "white" as const },
  });

  // Zone labels the room interior
  const zone = ZoneNode.parse({
    name: "Main Room",
    polygon: [
      [0, 0],
      [W, 0],
      [W, D],
      [0, D],
    ] as [number, number][],
    color: "#e8f4f8",
  });

  // Insert all nodes in one atomic batch.
  // createNodes auto-wires parentId on each node and pushes to the parent's
  // children array. Building is a root (no parentId). Everything else is parented.
  // Use the parsed node's .id (typed as building_${string}, level_${string}, etc.)
  // so the AnyNodeId discriminated union is satisfied without unsafe casting.
  createNodes([
    { node: building },
    { node: level, parentId: building.id },
    { node: wallN, parentId: level.id },
    { node: wallE, parentId: level.id },
    { node: wallS, parentId: level.id },
    { node: wallW, parentId: level.id },
    { node: zone, parentId: level.id },
  ]);
}
