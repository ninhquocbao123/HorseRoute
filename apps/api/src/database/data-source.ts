import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../../.env') });
import { DataSource } from 'typeorm';
import { mysqlSsl } from './mysql-ssl';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: mysqlSsl(process.env.DB_SSL, process.env.DB_SSL_CA_PATH),
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
