import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/node_modules/server-only/empty.js",
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
};

export default config;
