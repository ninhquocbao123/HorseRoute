import { DataSource } from 'typeorm';
export class HealthService {
  constructor(private readonly db: DataSource) {}
  async check() {
    await this.db.query('SELECT 1');
    return { status: 'ok', info: { mysql: { status: 'up' } }, error: {}, details: { mysql: { status: 'up' } } };
  }
}

