import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  authSecret: string;
  adjutorBaseUrl: string;
  adjutorApiKey: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    url?: string;
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function buildConfig(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3000),
    authSecret: nodeEnv === 'production'
      ? requireEnv('AUTH_SECRET')
      : (process.env.AUTH_SECRET ?? 'dev_auth_secret'),
    adjutorBaseUrl: process.env.ADJUTOR_BASE_URL ?? 'https://adjutor.lendsqr.com/v2',
    adjutorApiKey: process.env.ADJUTOR_API_KEY ?? '',
    db: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      name: process.env.DB_NAME ?? 'demo_credit',
      url: process.env.DATABASE_URL,
    },
  };
}

export const env = buildConfig();
