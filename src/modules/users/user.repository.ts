import type { Knex } from 'knex';
import { getKnex } from '../../database/knex';
import { UserRecord } from '../../database/types';
import { CreateUserData } from './user.types';

export class UserRepository {
  constructor(private readonly db: Knex = getKnex()) {}

  async findByEmail(email: string, trx?: Knex.Transaction): Promise<UserRecord | undefined> {
    return this.query(trx)('users').where({ email: email.toLowerCase() }).first();
  }

  async findByBvn(bvn: string, trx?: Knex.Transaction): Promise<UserRecord | undefined> {
    return this.query(trx)('users').where({ bvn }).first();
  }

  async findByPhone(phone: string, trx?: Knex.Transaction): Promise<UserRecord | undefined> {
    return this.query(trx)('users').where({ phone }).first();
  }

  async findById(id: string, trx?: Knex.Transaction): Promise<UserRecord | undefined> {
    return this.query(trx)('users').where({ id }).first();
  }

  async create(data: CreateUserData, trx?: Knex.Transaction): Promise<UserRecord> {
    const timestamp = this.query(trx).fn.now();

    await this.query(trx)('users').insert({
      ...data,
      email: data.email.toLowerCase(),
      created_at: timestamp,
      updated_at: timestamp,
    });

    const user = await this.findById(data.id, trx);

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  private query(trx?: Knex.Transaction): Knex {
    return trx ?? this.db;
  }
}
