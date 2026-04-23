import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for unit tests over our pure helpers
 * (`lib/utils.ts`, `lib/cart-math.ts`).
 *
 * No DOM, no React renderer, no Prisma — these tests run as plain
 * Node modules, so they're fast (sub-second) and CI-friendly. Add a
 * jsdom environment later if/when we start testing client components.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/cart-math.ts", "lib/utils.ts"],
    },
  },
  resolve: {
    alias: {
      // Mirror the `@/*` paths in tsconfig so tests can import using the
      // same paths as the app.
      "@": path.resolve(__dirname, "."),
    },
  },
});
