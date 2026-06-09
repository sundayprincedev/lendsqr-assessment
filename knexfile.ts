import type { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const sharedConfig: Knex.Config = {
  client: 'mysql2',
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...sharedConfig,
    connection: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'demo_credit',
    },
  },
  production: {
    ...sharedConfig,
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;
