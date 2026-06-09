import type { Knex } from 'knex';
import { TransactionStatus } from '../../config/constants';
import { getKnex } from '../../database/knex';
import { TransactionRecord } from '../../database/types';
import { CreateTransactionData } from './wallet.types';

export class TransactionRepository {
  constructor(private readonly db: Knex = getKnex()) {}

  async findByReference(
    reference: string,
    trx?: Knex.Transaction,
  ): Promise<TransactionRecord | undefined> {
    return this.query(trx)('transactions').where({ reference }).first();
  }

  async findRecentByWalletId(
    walletId: string,
    limit: number,
    trx?: Knex.Transaction,
  ): Promise<TransactionRecord[]> {
    return this.query(trx)('transactions')
      .where({ wallet_id: walletId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  async create(
    data: CreateTransactionData,
    trx?: Knex.Transaction,
  ): Promise<TransactionRecord> {
    await this.query(trx)('transactions').insert({
      id: data.id,
      reference: data.reference,
      wallet_id: data.wallet_id,
      type: data.type,
      amount: data.amount,
      balance_before: data.balance_before,
      balance_after: data.balance_after,
      counterparty_wallet_id: data.counterparty_wallet_id ?? null,
      status: TransactionStatus.SUCCESS,
      metadata: null,
      created_at: this.query(trx).fn.now(),
    });

    const transaction = await this.query(trx)('transactions').where({ id: data.id }).first();

    if (!transaction) {
      throw new Error('Failed to create transaction');
    }

    return transaction;
  }

  private query(trx?: Knex.Transaction): Knex {
    return trx ?? this.db;
  }
}
