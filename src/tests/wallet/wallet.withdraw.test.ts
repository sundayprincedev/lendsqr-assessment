import type { Knex } from 'knex';
import { ErrorCode, TransactionStatus, TransactionType } from '../../config/constants';
import { TransactionRecord } from '../../database/types';
import { WalletRecord } from '../../database/types';
import { TransactionRepository } from '../../modules/wallet/transaction.repository';
import { WalletRepository } from '../../modules/wallet/wallet.repository';
import { WalletService } from '../../modules/wallet/wallet.service';
import { UserRepository } from '../../modules/users/user.repository';

const USER_ID = 'user-id';

function buildWallet(overrides: Partial<WalletRecord> = {}): WalletRecord {
  return {
    id: 'wallet-id',
    user_id: USER_ID,
    balance: 300_000,
    currency: 'NGN',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildTransaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: 'transaction-id',
    reference: 'unique-ref-003',
    wallet_id: 'wallet-id',
    type: TransactionType.DEBIT,
    amount: 100_000,
    balance_before: 300_000,
    balance_after: 200_000,
    counterparty_wallet_id: null,
    status: TransactionStatus.SUCCESS,
    metadata: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('WalletService.withdraw', () => {
  const walletRepository = {
    findByUserId: jest.fn(),
    findByUserIdForUpdate: jest.fn(),
    updateBalance: jest.fn(),
  } as unknown as jest.Mocked<WalletRepository>;

  const transactionRepository = {
    findByReference: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<TransactionRepository>;

  const userRepository = {} as unknown as jest.Mocked<UserRepository>;

  const transaction = jest.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
    return callback({} as Knex.Transaction);
  });

  const db = { transaction } as unknown as Knex;

  let walletService: WalletService;

  beforeEach(() => {
    jest.clearAllMocks();

    walletRepository.findByUserId.mockResolvedValue(buildWallet());
    walletRepository.findByUserIdForUpdate.mockResolvedValue(buildWallet());
    walletRepository.updateBalance.mockResolvedValue();
    transactionRepository.findByReference.mockResolvedValue(undefined);
    transactionRepository.create.mockImplementation(async (data) => buildTransaction({
      reference: data.reference,
      amount: data.amount,
      balance_before: data.balance_before,
      balance_after: data.balance_after,
    }));

    walletService = new WalletService(
      walletRepository,
      transactionRepository,
      userRepository,
      db,
    );
  });

  it('withdraws and returns updated balance', async () => {
    const result = await walletService.withdraw(USER_ID, {
      amount: 1000,
      reference: 'unique-ref-003',
    });

    expect(result.amount).toBe('1000.00');
    expect(result.balance_before).toBe('3000.00');
    expect(result.balance_after).toBe('2000.00');
    expect(walletRepository.updateBalance).toHaveBeenCalledWith('wallet-id', 200_000, expect.anything());
  });

  it('rejects when balance is insufficient', async () => {
    walletRepository.findByUserId.mockResolvedValue(buildWallet({ balance: 50_000 }));
    walletRepository.findByUserIdForUpdate.mockResolvedValue(buildWallet({ balance: 50_000 }));

    await expect(walletService.withdraw(USER_ID, {
      amount: 1000,
      reference: 'unique-ref-004',
    })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: ErrorCode.INSUFFICIENT_BALANCE,
    });
  });

  it('returns existing result for duplicate reference', async () => {
    transactionRepository.findByReference.mockResolvedValue(buildTransaction());

    const result = await walletService.withdraw(USER_ID, {
      amount: 1000,
      reference: 'unique-ref-003',
    });

    expect(result.balance_after).toBe('2000.00');
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(walletRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rejects duplicate reference used for a different operation', async () => {
    transactionRepository.findByReference.mockResolvedValue(buildTransaction({
      type: TransactionType.CREDIT,
    }));

    await expect(walletService.withdraw(USER_ID, {
      amount: 1000,
      reference: 'unique-ref-003',
    })).rejects.toMatchObject({
      statusCode: 409,
      errorCode: ErrorCode.DUPLICATE_REFERENCE,
    });
  });
});
