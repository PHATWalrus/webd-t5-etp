interface CloudflareEnv {
  DB: D1Database;
  API_LIMITER: RateLimit;
  START_LIMITER: RateLimit;
  APP_ORIGIN: string;
  AI_ENABLED: string;
  RATE_LIMIT_SALT: string;
  TYPESAFE_API_KEY: string;
}
