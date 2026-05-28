import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    env: {
      DB_PATH: ":memory:",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/main.ts"],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
});
