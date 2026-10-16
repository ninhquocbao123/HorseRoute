import { config } from 'dotenv';
import { resolve } from 'path';
import { createDatabase } from '../shared/config/db';
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(__dirname, '../../../../.env') });
export default createDatabase(process.env);

