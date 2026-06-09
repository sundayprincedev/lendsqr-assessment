import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.string('id', 36).primary();
    table.string('reference', 100).notNullable().unique();
    table
      .string('wallet_id', 36)
      .notNullable()
      .references('id')
      .inTable('wallets')
      .onDelete('RESTRICT');
    table
      .enum('type', ['credit', 'debit', 'transfer_in', 'transfer_out'])
      .notNullable();
    table.bigInteger('amount').notNullable();
    table.bigInteger('balance_before').notNullable();
    table.bigInteger('balance_after').notNullable();
    table
      .string('counterparty_wallet_id', 36)
      .nullable()
      .references('id')
      .inTable('wallets')
      .onDelete('RESTRICT');
    table
      .enum('status', ['pending', 'success', 'failed'])
      .notNullable()
      .defaultTo('success');
    table.json('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
}
