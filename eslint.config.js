// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");
const prettier = require("eslint-plugin-prettier");

module.exports = [
  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },

    plugins: {
      prettier,
    },

    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prettier/prettier": "warn",
    },
  },

  // Desktop renderer runs in a sandboxed browser context
  {
    files: ["desktop/renderer/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, module: "writable" },
    },
  },
];
