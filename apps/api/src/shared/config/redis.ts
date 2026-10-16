import Redis from 'ioredis';
export function createRedis(env: Record<string, any>) {
  const client = new Redis({ host: env.REDIS_HOST, port: Number(env.REDIS_PORT || 6379),
    password: env.REDIS_PASSWORD || undefined, lazyConnect: true, maxRetriesPerRequest: 2,
    retryStrategy: times => times > 5 ? null : Math.min(times * 200, 2000),
  });
  client.on('error', () => console.error('Redis connection error'));
  return client;
}

