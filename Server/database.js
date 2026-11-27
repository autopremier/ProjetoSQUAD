const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: 5432,
    database: "postgres",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: true
    },
    options: "-c search_path=squad",
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

async function query(sql, params = []) {
    return pool.query(sql, params);
}

module.exports = { pool, query };
