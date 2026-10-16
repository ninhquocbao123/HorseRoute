import { config } from 'dotenv';
import { resolve } from 'path';
import { envValidationSchema } from './env.validation';
import { ConfigurationError } from '../utils/logger.util';
export function loadEnvironment() {
  config({ path: resolve(process.cwd(), '.env') });
  config({ path: resolve(__dirname, '../../../../../.env') });
  const { value, error } = envValidationSchema.validate(process.env, { abortEarly: false });
  if (error) throw new ConfigurationError('INVALID_ENV', [...new Set(error.details.map(item => String(item.path[0])))]);
  return value as Record<string, any>;
}

