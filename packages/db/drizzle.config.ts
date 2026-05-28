import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: fileURLToPath(new URL("../../data/archispark.db", import.meta.url)),
  },
});
