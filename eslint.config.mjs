import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import reactNativePlugin from "eslint-plugin-react-native";
import tsParser from "@typescript-eslint/parser";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: [
      "**/*.{js,mjs,cjs,ts,tsx}"
    ],
    ignores: ["**/*.config.mjs"],
    languageOptions: {
      globals: globals.browser,
      parser: tsParser,
    },
    plugins: {
      "react-native": reactNativePlugin,
      "react": reactPlugin,
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactNativePlugin.configs.recommended.rules,
    },
  }
];
