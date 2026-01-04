// eslint.config.cjs
const js = require("@eslint/js");
const prettier = require("eslint-plugin-prettier");

module.exports = [
  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
      },
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
];
