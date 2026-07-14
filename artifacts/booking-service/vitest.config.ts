import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    reporters: ["default", "json"],
    outputFile: {
      json: "test-results/results.json",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/scripts/**"],
    },
    // Integration tests share one real Postgres database; run files
    // serially so cross-test cleanup can't race with another file's inserts.
    fileParallelism: false,
  },
});
