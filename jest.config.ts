import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/node_modules/server-only/empty.js",
    // Stub Three.js — requires WebGL/canvas, not available in Node tests
    "^three(.*)$": "<rootDir>/src/__mocks__/three.ts",
    // Pascal core mock re-exports store + schema but stubs out 3D systems/materials
    "^@pascal-app/core$": "<rootDir>/src/__mocks__/@pascal-app/core.ts",
    // Allow internal dist subpath imports from within the mock
    "^@pascal-app/core/dist/(.*)$": "<rootDir>/node_modules/@pascal-app/core/dist/$1",
  },
  testMatch: [
    "<rootDir>/src/__tests__/**/*.test.ts",
    "<rootDir>/src/app/**/__tests__/**/*.test.ts",
  ],
  // @pascal-app packages ship ESM-only .js files; transform them with ts-jest
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
    "^.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@pascal-app/|nanoid/))",
  ],
};

export default config;
