import { readFileSync } from 'fs';
import { isAbsolute } from 'path';
import { ConfigurationError } from '../shared/utils/logger.util';

function normalizeCa(ca: string) {
  const trimmed = ca.trim();
  return trimmed.includes('\\n') && !trimmed.includes('\n')
    ? trimmed.replace(/\\n/g, '\n')
    : trimmed;
}

/** Accept inline CA PEM (DB_SSL_CA) or an absolute CA path (DB_SSL_CA_PATH). */
export function mysqlSsl(enabled: boolean | string | undefined, caPath?: string, ca?: string) {
  if (enabled === undefined || enabled === false || enabled === 'false') return undefined;
  if (enabled !== true && enabled !== 'true') {
    throw new ConfigurationError('INVALID_SSL_CONFIG', ['DB_SSL']);
  }
  const inlineCa = typeof ca === 'string' ? normalizeCa(ca) : '';
  if (inlineCa) {
    return { ca: inlineCa, rejectUnauthorized: true };
  }
  if (!caPath || !isAbsolute(caPath)) {
    throw new ConfigurationError('INVALID_SSL_CONFIG', caPath ? ['DB_SSL_CA_PATH'] : ['DB_SSL_CA', 'DB_SSL_CA_PATH']);
  }
  return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
}
