module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // Allow console.log in development
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    // Allow unused variables that start with underscore
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    // Allow explicit any in some cases
    "@typescript-eslint/no-explicit-any": "warn",
  },
  ignorePatterns: ["dist/", "node_modules/", "*.js", "*.d.ts"],
};
