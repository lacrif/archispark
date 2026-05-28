import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: ["**/node_modules/**", "**/.next/**", "**/coverage/**", "**/*.config.*", "middleware.ts"],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "@workspace/ui": resolve(__dirname, "../../packages/ui/src"),
    },
  },
});
