import 'reflect-metadata';
import { createServer } from 'http';
import { createApp } from './app';
import { loadEnvironment } from './shared/config/env';
import { createDatabase } from './shared/config/db';
import { createRedis } from './shared/config/redis';
import { createServices } from './shared/config/services';
import { TokenService } from './shared/utils/jwt.util';
export async function startServer() {
  const env = loadEnvironment();
  const db = createDatabase(env), redis = createRedis(env);
  const tokens = new TokenService(env.JWT_SECRET);
  const services = createServices(db, tokens);
  const server = createServer(createApp({ services, tokens, corsOrigin: env.CORS_ORIGIN, production: env.NODE_ENV === 'production' }));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    services.documents.stopExpiryJob();
    const deadline = setTimeout(() => process.exit(1), 15_000); deadline.unref();
    await new Promise<void>(resolve => server.close(() => resolve()));
    redis.disconnect();
    if (db.isInitialized) await db.destroy();
    clearTimeout(deadline);
  };
  try {
    await db.initialize();
    await redis.connect();
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(env.PORT, () => { server.off('error', reject); resolve(); }); });
    services.documents.startExpiryJob();
    console.log('API listening on port ' + env.PORT);
    process.once('SIGINT', () => void stop());
    process.once('SIGTERM', () => void stop());
    return { server, stop };
  } catch (error) { await stop(); throw error; }
}
if (require.main === module) startServer().catch(error => {
  console.error('API startup failed:', error instanceof Error ? error.name : 'Unknown error');
  process.exitCode = 1;
});

