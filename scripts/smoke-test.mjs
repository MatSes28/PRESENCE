#!/usr/bin/env node
/**
 * Quick deploy smoke-test: health endpoints and optional CORS.
 * Run after deploy: API_BASE_URL=https://your-api.com node scripts/smoke-test.mjs
 */

const BASE = process.env.API_BASE_URL || "http://localhost:3000";

async function get(url, opts = {}) {
  const res = await fetch(url, { ...opts, redirect: "manual" });
  return { ok: res.ok, status: res.status, url: res.url };
}

async function main() {
  let failed = 0;

  // 1) GET /health
  try {
    const h = await get(`${BASE}/health`);
    if (h.ok && h.status === 200) {
      console.log("OK GET /health ->", h.status);
    } else {
      console.error("FAIL GET /health ->", h.status);
      failed++;
    }
  } catch (e) {
    console.error("FAIL GET /health:", e.message);
    failed++;
  }

  // 2) GET /api/health
  try {
    const a = await get(`${BASE}/api/health`);
    if (a.ok && a.status === 200) {
      console.log("OK GET /api/health ->", a.status);
    } else {
      console.error("FAIL GET /api/health ->", a.status);
      failed++;
    }
  } catch (e) {
    console.error("FAIL GET /api/health:", e.message);
    failed++;
  }

  // 3) Optional CORS (only if ORIGIN given)
  const origin = process.env.SMOKE_ORIGIN;
  if (origin) {
    try {
      const c = await get(`${BASE}/api/health`, {
        headers: { Origin: origin },
      });
      // Preflight would be OPTIONS; here we just check API is reachable from browser origin
      console.log("OK CORS check (GET with Origin) ->", c.status);
    } catch (e) {
      console.error("FAIL CORS check:", e.message);
      failed++;
    }
  } else {
    console.log("Skip CORS check (set SMOKE_ORIGIN to test)");
  }

  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error("FAIL smoke test:", error?.message || error);
  process.exitCode = 1;
});
