import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    env: {
      DB_PATH: ":memory:",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      exclude: ["**/package.json", "src/schema.ts"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
