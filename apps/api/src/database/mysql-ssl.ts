import { readFileSync } from 'fs';
import { isAbsolute } from 'path';

/** Use an absolute CA path so CLI migrations and the API resolve the same file. */
export function mysqlSsl(enabled: boolean | string | undefined, caPath?: string) {
  if (enabled === undefined || enabled === false || enabled === 'false') return undefined;
  if (enabled !== true && enabled !== 'true') {
    throw new Error('DB_SSL must be true or false');
  }
  if (!caPath || !isAbsolute(caPath)) {
    throw new Error('DB_SSL_CA_PATH must be an absolute path when DB_SSL=true');
  }
  return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
}
