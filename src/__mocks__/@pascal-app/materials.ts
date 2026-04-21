/**
 * Jest mock for @pascal-app/core/dist/materials.
 *
 * VERSION-COUPLED to @pascal-app/core@0.5.1. This stub re-exports the
 * material objects without pulling in Three.js dependencies. The actual
 * materials module dereferences Three at module load time, which fails in
 * Node tests without a WebGL context.
 *
 * On Pascal version upgrades, verify that baseMaterial and glassMaterial
 * are still the only exports, and that no new Three.js-dependent exports
 * have been added to the materials subpath.
 */
export const baseMaterial = {};
export const glassMaterial = {};
