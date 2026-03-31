import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const config = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".playwright-cli/**",
      ".wrangler/**",
      "node_modules/**",
      "public/medication-search/**",
      "next-env.d.ts",
      "types/cloudflare-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...nextVitals,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ]
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["data/**/*.js", "lib/**/*.js", "tests/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
];

export default config;
