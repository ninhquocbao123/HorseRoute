import { config } from 'dotenv';
import { resolve } from 'path';
import { envValidationSchema } from './env.validation';
export function loadEnvironment() {
  config({ path: resolve(process.cwd(), '.env') });
  config({ path: resolve(__dirname, '../../../../../.env') });
  const { value, error } = envValidationSchema.validate(process.env, { abortEarly: false });
  if (error) throw new Error('Invalid environment: ' + error.details.map(item => item.path.join('.')).join(', '));
  return value as Record<string, any>;
}

