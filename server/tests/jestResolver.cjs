const path = require("path");

// Jest custom resolver.
// Goal: support NodeNext-style TS imports that end with `.js` (e.g. `./storage.js`)
// by resolving them to the corresponding `.ts` source file when running tests.
//
// We only *attempt* the `.ts` translation for relative requests.
// For node_modules packages that use relative `./*.js` internally, we fall back
// to Jest's default resolver when no matching `.ts` file exists.

module.exports = (request, options) => {
  const defaultResolver =
    options && typeof options.defaultResolver === "function"
      ? options.defaultResolver
      : require("jest-resolve");

  // If we had to `require('jest-resolve')`, it exports helper functions and a
  // default class, not the resolver function. In that case we can't proceed.
  // This should not happen in normal Jest usage.
  if (typeof defaultResolver !== "function") {
    throw new Error(
      "Jest defaultResolver not provided to custom resolver; cannot resolve modules",
    );
  }

  const isRelative = request.startsWith("./") || request.startsWith("../");
  const endsWithJs = request.endsWith(".js");

  if (isRelative && endsWithJs) {
    const tsRequest = request.slice(0, -3) + ".ts";

    try {
      return defaultResolver(tsRequest, options);
    } catch (err) {
      // ignore and fall back
    }
  }

  return defaultResolver(request, options);
};
