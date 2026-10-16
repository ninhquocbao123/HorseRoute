// Only isolated test schemas are created by callers; never run migrations on DB_NAME.
const fs = require('node:fs');
const path = require('node:path');
const envPath = path.resolve(__dirname, '../../../.env');
const env = fs.existsSync(envPath) ? require('dotenv').parse(fs.readFileSync(envPath)) : {};
const { mysqlSsl } = require('../src/database/mysql-ssl');
module.exports = {
  host: process.env.TEST_DB_HOST || env.DB_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DB_PORT || env.DB_PORT || 3306),
  user: process.env.TEST_DB_USER || env.DB_USER,
  password: process.env.TEST_DB_PASSWORD || env.DB_PASSWORD,
  ssl: mysqlSsl(process.env.TEST_DB_SSL || env.DB_SSL, process.env.TEST_DB_SSL_CA_PATH || env.DB_SSL_CA_PATH),
  connectTimeout: 10000,
};
