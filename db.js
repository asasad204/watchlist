const { Pool } = require('pg');
require('dotenv').config();

function parseSsl(value) {
    if (!value) return false;
    const v = String(value).toLowerCase();
    if (v === 'true' || v === '1') return { rejectUnauthorized: true };
    return false;
}

function parseIntOr(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
}

const useUrl = !!process.env.DATABASE_URL;

const pool = useUrl
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: parseSsl(process.env.DB_SSL),
        max: parseIntOr(process.env.POOL_SIZE, 10),
        options: process.env.DEFAULT_SCHEMA
            ? `-c search_path=${process.env.DEFAULT_SCHEMA}`
            : undefined
    })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseIntOr(process.env.DB_PORT, 5432),
        user: process.env.DB_USER,
        password: String(process.env.DB_PASS || ''),
        database: process.env.DB_NAME,
        ssl: parseSsl(process.env.DB_SSL),
        max: parseIntOr(process.env.POOL_SIZE, 10),
        options: process.env.DEFAULT_SCHEMA
            ? `-c search_path=${process.env.DEFAULT_SCHEMA}`
            : undefined
    });

pool.on('error', (err) => {
    console.error('Unexpected idle client error:', err);
});
/*
async function testConnection() {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
        console.log('Database connection successful');
    } finally {
        client.release();
    }
}
*/
async function query(text, params) {
    return pool.query(text, params);
}

module.exports = { pool, query };