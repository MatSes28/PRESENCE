module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.node.json"],
  },
  plugins: ["react-refresh", "@typescript-eslint", "react"],
  settings: {
    react: {
      version: "detect",
    },
  },
  rules: {
    "react-refresh/only-export-components": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "off",
    "react-hooks/exhaustive-deps": "warn",
    "react/prop-types": "off", // Using TypeScript for prop validation
    "react/no-unescaped-entities": "off", // Allow apostrophes in JSX
  },
};
