import { readFileSync } from 'fs';
import { isAbsolute } from 'path';
import { ConfigurationError } from '../shared/utils/logger.util';

/** Use an absolute CA path so CLI migrations and the API resolve the same file. */
export function mysqlSsl(enabled: boolean | string | undefined, caPath?: string) {
  if (enabled === undefined || enabled === false || enabled === 'false') return undefined;
  if (enabled !== true && enabled !== 'true') {
    throw new ConfigurationError('INVALID_SSL_CONFIG', ['DB_SSL']);
  }
  if (!caPath || !isAbsolute(caPath)) {
    throw new ConfigurationError('INVALID_SSL_CONFIG', ['DB_SSL_CA_PATH']);
  }
  return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
}
