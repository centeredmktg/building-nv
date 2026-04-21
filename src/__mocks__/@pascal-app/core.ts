/**
 * Jest mock for @pascal-app/core.
 *
 * VERSION-COUPLED to @pascal-app/core@0.5.1. Re-verify on every Pascal
 * version bump — this mock reaches into the package's dist/ subpaths,
 * which are not part of its public API and can move between minor
 * releases in pre-1.0.
 *
 * Re-exports the real store and schema modules while stubbing out the
 * Three.js-dependent materials and 3D systems. This lets unit tests run
 * in Node without a WebGL context.
 *
 * Real zustand store + zod schemas are re-exported; only Three.js-
 * dependent systems and materials are stubbed.
 */

// Store (zustand + zundo only — no Three.js)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const useSceneModule = require("@pascal-app/core/dist/store/use-scene");
export const useScene = useSceneModule.default;
export const clearSceneHistory = useSceneModule.clearSceneHistory;

// Schema primitives
// eslint-disable-next-line @typescript-eslint/no-require-imports
const base = require("@pascal-app/core/dist/schema/base");
export const BaseNode = base.BaseNode;
export const generateId = base.generateId;
export const Material = base.Material;
export const nodeType = base.nodeType;
export const objectId = base.objectId;

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const { BuildingNode } = require("@pascal-app/core/dist/schema/nodes/building");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const { LevelNode } = require("@pascal-app/core/dist/schema/nodes/level");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const { WallNode } = require("@pascal-app/core/dist/schema/nodes/wall");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const { ZoneNode } = require("@pascal-app/core/dist/schema/nodes/zone");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const { SiteNode } = require("@pascal-app/core/dist/schema/nodes/site");

// Materials — stubbed (would require Three.js / WebGL)
export const baseMaterial = {};
export const glassMaterial = {};

// Systems — stubbed (each requires Three.js / WebGL)
export const WallSystem = {};
export const FenceSystem = {};
export const DoorSystem = {};
export const ItemSystem = {};
export const RoofSystem = {};
export const SlabSystem = {};
export const StairSystem = {};
export const CeilingSystem = {};
export const WindowSystem = {};

// Wall helpers
export const DEFAULT_WALL_HEIGHT = 2.7;
export const DEFAULT_WALL_THICKNESS = 0.15;
export const getWallPlanFootprint = () => [];
export const getWallThickness = () => DEFAULT_WALL_THICKNESS;
