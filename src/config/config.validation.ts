import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),

  MONGO_URI: Joi.string().uri().required(),
  REDIS_URL: Joi.string().required(),

  ADMIN_SECRET: Joi.string().min(16).required(),

  NOKIA_API_KEY: Joi.string().optional().allow(''),
  NOKIA_WEBHOOK_SECRET: Joi.string().optional().allow(''),
  NOKIA_WEBHOOK_BASE_URL: Joi.string().optional().allow(''),
  NOKIA_MCP_SERVER_URL: Joi.string().optional().allow(''),

  PIPELINE_VERSION: Joi.string().valid('v1', 'v2').default('v1'),

  AT_API_KEY: Joi.string().optional().allow(''),
  AT_USERNAME: Joi.string().optional().allow(''),

  OPENROUTER_API_KEY: Joi.string().optional().allow(''),
  OPENROUTER_MODEL: Joi.string().optional(),

  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
});
