const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || "127.0.0.1",
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "sandcastle_resort",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
  queueLimit: 100,
});

async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log("✓ Connected to MySQL database");
  } finally {
    connection.release();
  }
}

module.exports = { pool, testConnection };
