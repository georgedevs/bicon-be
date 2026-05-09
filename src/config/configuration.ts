export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  database: {
    uri: process.env.MONGO_URI,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  admin: {
    secret: process.env.ADMIN_SECRET,
  },

  nokia: {
    apiKey: process.env.NOKIA_API_KEY,
    webhookSecret: process.env.NOKIA_WEBHOOK_SECRET,
    webhookBaseUrl: process.env.NOKIA_WEBHOOK_BASE_URL || 'http://localhost:3000',
    mcpServerUrl: process.env.NOKIA_MCP_SERVER_URL,
  },

  pipeline: {
    version: process.env.PIPELINE_VERSION || 'v1',
  },

  africasTalking: {
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-5',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  congestion: {
    pollIntervalMs: parseInt(process.env.CONGESTION_POLL_INTERVAL_MS || '60000', 10),
    testPhoneNumber: process.env.CAMARA_TEST_PHONE || '+99999991000',
  },
});
