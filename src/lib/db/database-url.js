/**
 * Build MySQL connection URL from parts or env DATABASE_URL template.
 */
export function buildDatabaseUrl({ host, port = 3306, user, password, database }) {
  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `mysql://${encUser}:${encPass}@${host}:${port}/${database}`;
}

export function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

/** Suggest dedicated DB name from main URL + branch code (Hostinger-style). */
export function suggestDedicatedDbName(mainUrl, branchCode) {
  const parsed = parseDatabaseUrl(mainUrl);
  if (!parsed?.database) return null;
  const suffix = branchCode.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const base = parsed.database.replace(/_([a-z0-9]+)$/i, '') || parsed.database;
  return `${base}_${suffix}`;
}
