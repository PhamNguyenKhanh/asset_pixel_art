import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/core/**/*.ts", "src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "Core Engine and Feature Modules must not depend on React.",
            },
            {
              name: "react-dom",
              message: "Core Engine and Feature Modules must not depend on React DOM.",
            },
            {
              name: "next",
              message: "Core Engine and Feature Modules must not depend on Next.js.",
            },
            {
              name: "zustand",
              message: "Core Engine and Feature Modules must not depend on Zustand UI stores.",
            },
          ],
          patterns: [
            {
              group: ["next/*", "@/components/*", "@/stores/*", "@/hooks/*", "@/app/*"],
              message: "Core Engine and Feature Modules must remain decoupled from UI and Next.js layers.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
