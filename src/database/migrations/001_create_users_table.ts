import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('phone', 20).notNullable().unique();
    table.string('bvn', 11).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.boolean('karma_checked_email').notNullable().defaultTo(false);
    table.boolean('karma_checked_bvn').notNullable().defaultTo(false);
    table.boolean('is_blacklisted').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
