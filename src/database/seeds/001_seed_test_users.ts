import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import { randomUUID } from 'crypto';

const PASSWORD = 'SecurePass123!';
const SALT_ROUNDS = 10;

interface SeedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  bvn: string;
  initialBalanceKobo: number;
}

const seedUsers: SeedUser[] = [
  {
    id: randomUUID(),
    name: 'John Doe',
    email: 'john@example.com',
    phone: '08012345678',
    bvn: '12345678901',
    initialBalanceKobo: 500_000,
  },
  {
    id: randomUUID(),
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '08087654321',
    bvn: '10987654321',
    initialBalanceKobo: 1_000_000,
  },
  {
    id: randomUUID(),
    name: 'Alex Smith',
    email: 'alex@example.com',
    phone: '08099887766',
    bvn: '11223344556',
    initialBalanceKobo: 0,
  },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('transactions').del();
  await knex('wallets').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const timestamp = knex.fn.now();

  for (const user of seedUsers) {
    const walletId = randomUUID();

    await knex('users').insert({
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase(),
      phone: user.phone,
      bvn: user.bvn,
      password_hash: passwordHash,
      karma_checked_email: true,
      karma_checked_bvn: true,
      is_blacklisted: false,
      created_at: timestamp,
      updated_at: timestamp,
    });

    await knex('wallets').insert({
      id: walletId,
      user_id: user.id,
      balance: user.initialBalanceKobo,
      currency: 'NGN',
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
}
