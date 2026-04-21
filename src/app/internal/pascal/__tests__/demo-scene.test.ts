import { describe, it, expect, beforeEach } from "@jest/globals";
import { seedDemoScene } from "../demo-scene";
import useScene from "@pascal-app/core/dist/store/use-scene";

describe("demo-scene", () => {
  beforeEach(() => {
    // Reset store to empty state before each test
    useScene.getState().unloadScene();
  });

  it("seeds a valid building + level + zone into the scene store", () => {
    const before = Object.keys(useScene.getState().nodes).length;
    seedDemoScene();
    const after = Object.keys(useScene.getState().nodes).length;
    expect(after).toBeGreaterThan(before);
  });

  it("seeds exactly 7 nodes (building, level, 4 walls, zone)", () => {
    useScene.getState().unloadScene();
    seedDemoScene();
    expect(Object.keys(useScene.getState().nodes).length).toBe(7);
  });

  it("creates a root building node", () => {
    seedDemoScene();
    const { nodes, rootNodeIds } = useScene.getState();
    const rootBuildings = rootNodeIds
      .map((id) => nodes[id])
      .filter((n) => n?.type === "building");
    expect(rootBuildings.length).toBeGreaterThan(0);
  });
});
