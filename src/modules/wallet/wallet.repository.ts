import type { Knex } from 'knex';
import { DEFAULT_CURRENCY } from '../../config/constants';
import { getKnex } from '../../database/knex';
import { WalletRecord } from '../../database/types';

export interface CreateWalletData {
  id: string;
  user_id: string;
  balance?: number;
}

export class WalletRepository {
  constructor(private readonly db: Knex = getKnex()) {}

  async findById(id: string, trx?: Knex.Transaction): Promise<WalletRecord | undefined> {
    return this.query(trx)('wallets').where({ id }).first();
  }

  async findByUserId(userId: string, trx?: Knex.Transaction): Promise<WalletRecord | undefined> {
    return this.query(trx)('wallets').where({ user_id: userId }).first();
  }

  async findByUserIdForUpdate(
    userId: string,
    trx: Knex.Transaction,
  ): Promise<WalletRecord | undefined> {
    return trx('wallets').where({ user_id: userId }).forUpdate().first();
  }

  async findByIdForUpdate(
    walletId: string,
    trx: Knex.Transaction,
  ): Promise<WalletRecord | undefined> {
    return trx('wallets').where({ id: walletId }).forUpdate().first();
  }

  async updateBalance(
    walletId: string,
    balance: number,
    trx: Knex.Transaction,
  ): Promise<void> {
    await trx('wallets')
      .where({ id: walletId })
      .update({
        balance,
        updated_at: trx.fn.now(),
      });
  }

  async create(data: CreateWalletData, trx?: Knex.Transaction): Promise<WalletRecord> {
    const timestamp = this.query(trx).fn.now();

    await this.query(trx)('wallets').insert({
      id: data.id,
      user_id: data.user_id,
      balance: data.balance ?? 0,
      currency: DEFAULT_CURRENCY,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });

    const wallet = await this.query(trx)('wallets').where({ id: data.id }).first();

    if (!wallet) {
      throw new Error('Failed to create wallet');
    }

    return wallet;
  }

  private query(trx?: Knex.Transaction): Knex {
    return trx ?? this.db;
  }
}
