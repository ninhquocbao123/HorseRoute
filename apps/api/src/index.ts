import 'reflect-metadata';
import { createServer } from 'http';
import { createApp } from './app';
import { loadEnvironment } from './shared/config/env';
import { createDatabase } from './shared/config/db';
import { createRedis } from './shared/config/redis';
import { createServices } from './shared/config/services';
import { TokenService } from './shared/utils/jwt.util';
import { Logger, safeError } from './shared/utils/logger.util';

const logger = new Logger('API');
const defaults = { loadEnvironment, createDatabase, createRedis, createServices, createServer, createApp };

// Factory overrides let lifecycle tests simulate failure without touching real services.
export async function startServer(overrides: Partial<typeof defaults> = {}) {
  const dependencies = { ...defaults, ...overrides };
  let stage = 'config';
  let db: ReturnType<typeof createDatabase> | undefined;
  let redis: ReturnType<typeof createRedis> | undefined;
  let services: ReturnType<typeof createServices> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let stopping: Promise<void> | undefined;

  const shutdownOnSignal = () => {
    void stop().catch(() => { process.exitCode = 1; });
  };
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      logger.info('shutdown_started');
      const deadline = setTimeout(() => {
        logger.error('shutdown_timeout', { timeoutMs: 15_000 });
        process.exit(1);
      }, 15_000);
      deadline.unref();
      let failed = false;
      const cleanup = async (component: string, action: () => unknown) => {
        try { await action(); }
        catch (error) {
          failed = true;
          logger.error('cleanup_failed', { component, ...safeError(error) });
        }
      };
      try {
        // Stop scheduling jobs immediately, drain active work before closing MySQL.
        await Promise.all([
          cleanup('expiry_job', () => services?.documents.stopExpiryJob()),
          cleanup('position_retention_job', () => services?.tracking.stopPositionRetentionJob()),
          cleanup('http', () => new Promise<void>((resolve, reject) => {
            if (!server?.listening) { resolve(); return; }
            server.close(error => error ? reject(error) : resolve());
          })),
        ]);
        await cleanup('redis', () => redis?.disconnect());
        await cleanup('mysql', async () => { if (db?.isInitialized) await db.destroy(); });
      } finally {
        clearTimeout(deadline);
        process.removeListener('SIGINT', shutdownOnSignal);
        process.removeListener('SIGTERM', shutdownOnSignal);
      }
      if (failed) throw new Error('Cleanup failed; see cleanup_failed logs');
      logger.info('shutdown_completed');
    })();
    return stopping;
  };

  const step = async <T>(name: string, action: () => T | Promise<T>): Promise<T> => {
    stage = name;
    logger.info('startup_step_started', { stage });
    const result = await action();
    logger.info('startup_step_completed', { stage });
    return result;
  };

  try {
    const env = await step('config', () => dependencies.loadEnvironment());
    db = await step('mysql_config', () => dependencies.createDatabase(env));
    await step('application', () => {
      redis = dependencies.createRedis(env);
      const tokens = new TokenService(env.JWT_SECRET);
      services = dependencies.createServices(db!, tokens);
      server = dependencies.createServer(dependencies.createApp({
        services, tokens, corsOrigin: env.CORS_ORIGIN, production: env.NODE_ENV === 'production',
      }));
    });
    await step('mysql', () => db!.initialize());
    await step('redis', () => redis!.connect());
    await step('http', () => new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server!.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        server!.removeListener('error', onError);
        resolve();
      };
      server!.once('error', onError);
      server!.once('listening', onListening);
      server!.listen(env.PORT);
    }));
    await step('expiry_job', () => services!.documents.startExpiryJob());
    await step('position_retention_job', () => services!.tracking.startPositionRetentionJob());
    logger.info('api_listening', { port: env.PORT });
    process.once('SIGINT', shutdownOnSignal);
    process.once('SIGTERM', shutdownOnSignal);
    return { server: server!, stop };
  } catch (error) {
    logger.error('startup_failed', { stage, ...safeError(error) });
    // Cleanup errors are logged separately and must not replace the original failure.
    try { await stop(); } catch { /* already logged */ }
    throw error;
  }
}

if (require.main === module) {
  void startServer().catch(() => { process.exitCode = 1; });
}
