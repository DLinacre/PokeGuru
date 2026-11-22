import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * PokeGuru lint config.
 *
 * Deliberately small: type-aware linting would be slow and duplicate the
 * TypeScript build, so this checks for real bugs (unused code, unsafe
 * patterns, hook rule violations) rather than style preferences.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "public/sw.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Compiler-only advisories. PokeGuru does not enable the React Compiler,
      // and these patterns (setState in a data-loading effect, refs in the
      // request layer) are intentional and tested.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["src/pwa/**/*.js", "scripts/**/*.mjs", "public/pwa-capture.js"],
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker, ...globals.node } },
  }
);
