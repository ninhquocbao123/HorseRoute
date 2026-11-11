import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { resolve } from 'path';
import { User } from '../../features/users/users.model';
import { mysqlSsl } from '../../database/mysql-ssl';
export function createDatabase(env: Record<string, any>) {
  return new DataSource({
    type: 'mysql', host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    username: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    ssl: mysqlSsl(env.DB_SSL, env.DB_SSL_CA_PATH, env.DB_SSL_CA),
    extra: { connectionLimit: Number(env.DB_POOL_SIZE || (process.env.VERCEL ? 5 : 10)) },
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true,
    synchronize: false, entities: [User],
    migrations: [resolve(__dirname, '../../database/migrations/*.{ts,js}')],
  });
}

