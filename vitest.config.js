import { defineConfig, configDefaults } from "vitest/config";

// Las copias de trabajo de otras sesiones (.claude/worktrees) tienen sus propias pruebas.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
