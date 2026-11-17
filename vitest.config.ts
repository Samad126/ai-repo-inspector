import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `npm run build` emits compiled copies of the tests into dist/; running
    // them too would double-count and can hide failures behind stale code.
    exclude: [...configDefaults.exclude, "dist/**"],
  },
});
