import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('wallets', (table) => {
    table.string('id', 36).primary();
    table
      .string('user_id', 36)
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.bigInteger('balance').notNullable().defaultTo(0);
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('wallets');
}
