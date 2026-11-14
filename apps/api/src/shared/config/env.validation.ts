import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().required(),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_SSL_CA: Joi.string().allow('').optional(),
  DB_SSL_CA_PATH: Joi.when('DB_SSL', {
    is: true,
    then: Joi.when('DB_SSL_CA', {
      is: Joi.string().trim().min(1).required(),
      then: Joi.string().allow('').optional(),
      otherwise: Joi.string().trim().min(1).required(),
    }),
    otherwise: Joi.string().allow('').optional(),
  }),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_SECRET: Joi.string().min(32).required(),
  DOCUMENT_STORAGE_PROVIDER: Joi.string().valid('local', 'supabase').default('local'),
  SUPABASE_URL: Joi.string().uri({ scheme: ['https'] }).when('DOCUMENT_STORAGE_PROVIDER', {
    is: 'supabase', then: Joi.required(), otherwise: Joi.optional(),
  }),
  SUPABASE_SECRET_KEY: Joi.string().when('DOCUMENT_STORAGE_PROVIDER', {
    is: 'supabase', then: Joi.required(), otherwise: Joi.optional(),
  }),
  SUPABASE_STORAGE_BUCKET: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]{0,62}$/).default('wdp-documents'),

  // Không đặt: dùng OSRM và Photon công khai. Đặt rỗng: tắt dịch vụ. Xem shared/config/map-services.ts.
  MAP_ROUTING_URL: Joi.string().trim().uri({ scheme: ['http', 'https'] }).allow('').optional(),
  MAP_GEOCODING_URL: Joi.string().trim().uri({ scheme: ['http', 'https'] }).allow('').optional(),
  TRACK_POSITION_RETENTION_DAYS: Joi.number().integer().min(1).max(365).default(30),

}).unknown(true);


