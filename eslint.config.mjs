import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Data fetching inside useEffect is a valid React pattern.
      // The react-compiler rule flags async functions that call setState,
      // but this is intentional for fetch-on-mount + interval refresh patterns.
      "react-compiler/react-compiler": "off",
    },
  },
]);

export default eslintConfig;
