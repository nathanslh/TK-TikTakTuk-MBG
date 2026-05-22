const { Pool } = require('pg');
const config = require('./env');
const isDbConfigured = Boolean(config.databaseUrl);
const pool = isDbConfigured
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false },
      idleTimeoutMillis: config.dbConnMaxAgeSeconds * 1000
    })
  : null;
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL error:', err.message);
  });
}
async function query(text, params) {
  if (!pool) {
    throw new Error('DATABASE_URL belum di-set. Tambahkan di .env terlebih dulu.');
  }
  return pool.query(text, params);
}
module.exports = {
  pool,
  query,
  isDbConfigured
};
