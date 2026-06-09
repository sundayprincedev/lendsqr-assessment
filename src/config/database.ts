import type { Knex } from "knex";
import knex from "knex";
import { env } from "./env";

function createConnectionConfig(): Knex.StaticConnectionConfig | string {
  if (env.db.url) {
    return env.db.url;
  }

  return {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
  };
}

export function createKnexInstance(): Knex {
  return knex({
    client: "mysql2",
    connection: createConnectionConfig(),
    pool: {
      min: 2,
      max: 10,
    },
  });
}
