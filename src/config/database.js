import mysql from "mysql2/promise";
import config from "./config.js";

// connection pool setting
const poolConfig = {
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,    
    connectionLimit: 100,
    queueLimit: 1000,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 60000,
    connectTimeout: 10000,
    maxIdle: 10,
}

const pool = mysql.createPool(poolConfig);

async function query(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

async function getConnection() {
    return await pool.getConnection();
}

export default {
    query,
    getConnection
}