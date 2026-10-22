import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/game/**/*.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
