function toBoolean(value, fallback) {
  if (typeof value === 'undefined') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
function parseAllowedHosts(rawHosts) {
  if (!rawHosts) {
    return [];
  }
  return String(rawHosts)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}
const isProduction = toBoolean(process.env.PRODUCTION, process.env.NODE_ENV === 'production');
const debug = toBoolean(process.env.DEBUG, !isProduction);
const config = {
  isProduction,
  debug,
  port: Number(process.env.PORT) || 3000,
  secretKey: process.env.SECRET_KEY || '',
  allowedHosts: parseAllowedHosts(process.env.ALLOWED_HOSTS),
  databaseUrl: process.env.DATABASE_URL || '',
  dbConnMaxAgeSeconds: Number(process.env.DB_CONN_MAX_AGE) || 600
};
module.exports = config;
