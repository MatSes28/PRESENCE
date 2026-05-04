function parseDatabaseUrls() {
  const raw = process.env.DATABASE_URLS || process.env.DATABASE_URL;

  if (!raw || !raw.trim()) {
    throw new Error(
      "Missing DATABASE_URL or DATABASE_URLS. Set one of them before running this script.",
    );
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getRequiredDatabaseUrl() {
  const urls = parseDatabaseUrls();
  return urls[0];
}

function getRequiredDatabaseUrls() {
  return parseDatabaseUrls();
}

function getDatabaseLabel(url, fallback = "database") {
  try {
    return new URL(url).host || fallback;
  } catch {
    return fallback;
  }
}

module.exports = {
  getRequiredDatabaseUrl,
  getRequiredDatabaseUrls,
  getDatabaseLabel,
};
