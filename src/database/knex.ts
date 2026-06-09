import type { Knex } from 'knex';
import { createKnexInstance } from '../config/database';

let instance: Knex | null = null;

export function getKnex(): Knex {
  if (!instance) {
    instance = createKnexInstance();
  }
  return instance;
}

export async function destroyKnex(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
