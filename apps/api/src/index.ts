import 'reflect-metadata';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { createApp } from './app';
import { loadEnvironment } from './shared/config/env';
import { createDatabase } from './shared/config/db';
import { createRedis } from './shared/config/redis';
import { createServices } from './shared/config/services';
import { TokenService } from './shared/utils/jwt.util';
import { Logger, safeError } from './shared/utils/logger.util';
import { socketService } from './shared/socket/socket.service';

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
      socketService.attach(server, tokens, env.CORS_ORIGIN, db!);
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

type ServerlessRuntime = {
  app: ReturnType<typeof createApp>;
  db: ReturnType<typeof createDatabase>;
};

/** Build a lazy, race-free HTTP handler for Vercel serverless without binding a port or background timers. */
export function createServerlessHandler(overrides: Partial<typeof defaults> = {}) {
  const dependencies = { ...defaults, ...overrides };
  let runtimePromise: Promise<ServerlessRuntime> | undefined;
  let reconnectPromise: Promise<void> | undefined;

  const ensureInitialized = async (db: ReturnType<typeof createDatabase>) => {
    if (db.isInitialized) return;
    if (!reconnectPromise) {
      reconnectPromise = db.initialize().then(() => undefined).finally(() => {
        reconnectPromise = undefined;
      });
    }
    await reconnectPromise;
  };

  const getRuntime = async (): Promise<ServerlessRuntime> => {
    if (!runtimePromise) {
      let created: Promise<ServerlessRuntime> | undefined;
      created = (async () => {
        await Promise.resolve();
        let db: ReturnType<typeof createDatabase> | undefined;
        try {
          const env = dependencies.loadEnvironment();
          db = dependencies.createDatabase(env);
          const tokens = new TokenService(env.JWT_SECRET);
          const services = dependencies.createServices(db, tokens);
          const app = dependencies.createApp({
            services,
            tokens,
            corsOrigin: env.CORS_ORIGIN,
            production: env.NODE_ENV === 'production',
          });
          await ensureInitialized(db);
          return { app, db };
        } catch (error) {
          if (runtimePromise === created) {
            runtimePromise = undefined;
          }
          if (db?.isInitialized) {
            try { await db.destroy(); } catch { /* ignore cleanup failure */ }
          }
          throw error;
        }
      })();
      runtimePromise = created;
    }
    const runtime = await runtimePromise;
    await ensureInitialized(runtime.db);
    return runtime;
  };

  return async function handleVercelRequest(req: IncomingMessage, res: ServerResponse) {
    try {
      const { app } = await getRuntime();
      app(req, res);
    } catch (error) {
      logger.error('serverless_startup_failed', safeError(error));
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ statusCode: 500, message: 'Internal Server Error' }));
      }
    }
  };
}

const serverlessHandler = createServerlessHandler();
export default serverlessHandler;

if (require.main === module) {
  void startServer().catch(() => { process.exitCode = 1; });
}
