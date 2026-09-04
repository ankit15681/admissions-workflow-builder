// Flat ESLint config (ESLint 9) covering both packages from the repo root:
//   - backend/  Node + TypeScript (Express)
//   - frontend/ React + TypeScript
// Prettier owns formatting; eslint-config-prettier (last in the array) turns off
// any stylistic rules that would fight it, so ESLint stays focused on correctness.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // Never lint build output, deps, generated bundles, or config files themselves.
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "backend/data/**",
      "frontend/public/**",
      "**/*.config.js",
      "**/*.config.cjs",
      "**/*.config.mjs",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend — runs in Node.
  {
    files: ["backend/**/*.{ts,cts,mts}"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // This is a server: console output is intentional, but should be deliberate.
      // Each real log site opts in with an inline `eslint-disable-next-line no-console`.
      "no-console": "error",
    },
  },

  // Frontend — runs in the browser, uses React + hooks.
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Not needed with the modern JSX transform (React 17+).
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // TypeScript already checks prop types.
      "react/prop-types": "off",
    },
  },

  // Project-wide rule tweaks: allow intentionally-unused args/vars when prefixed
  // with an underscore — the common convention for "I know, it's deliberate".
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          // Allow the `const { execute, ...rest } = def` pattern used to omit a field.
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Must stay last: disables formatting rules that overlap with Prettier.
  prettier,
);
