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
    balance: 0,
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
    reference: 'unique-ref-001',
    wallet_id: 'wallet-id',
    type: TransactionType.CREDIT,
    amount: 500_000,
    balance_before: 0,
    balance_after: 500_000,
    counterparty_wallet_id: null,
    status: TransactionStatus.SUCCESS,
    metadata: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('WalletService.fund', () => {
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

  it('funds wallet and returns updated balance', async () => {
    const result = await walletService.fund(USER_ID, {
      amount: 5000,
      reference: 'unique-ref-001',
    });

    expect(result.current_balance).toBe('5000.00');
    expect(result.transaction.type).toBe(TransactionType.CREDIT);
    expect(walletRepository.updateBalance).toHaveBeenCalledWith('wallet-id', 500_000, expect.anything());
  });

  it('records correct balance_before and balance_after', async () => {
    walletRepository.findByUserId.mockResolvedValue(buildWallet({ balance: 100_000 }));
    walletRepository.findByUserIdForUpdate.mockResolvedValue(buildWallet({ balance: 100_000 }));

    const result = await walletService.fund(USER_ID, {
      amount: 5000,
      reference: 'unique-ref-002',
    });

    expect(result.transaction.balance_before).toBe('1000.00');
    expect(result.transaction.balance_after).toBe('6000.00');
  });

  it('returns existing result for duplicate reference', async () => {
    transactionRepository.findByReference.mockResolvedValue(buildTransaction({
      reference: 'unique-ref-001',
      amount: 500_000,
      balance_before: 0,
      balance_after: 500_000,
    }));

    const result = await walletService.fund(USER_ID, {
      amount: 5000,
      reference: 'unique-ref-001',
    });

    expect(result.current_balance).toBe('5000.00');
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(walletRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('returns wallet details for authenticated user', async () => {
    walletRepository.findByUserId.mockResolvedValue(buildWallet({ balance: 500_000 }));

    const result = await walletService.getWallet(USER_ID);

    expect(result).toEqual({
      id: 'wallet-id',
      balance: '5000.00',
      currency: 'NGN',
      is_active: true,
    });
  });

  it('rejects duplicate reference used by another wallet', async () => {
    transactionRepository.findByReference.mockResolvedValue(buildTransaction({
      wallet_id: 'other-wallet',
      type: TransactionType.CREDIT,
    }));

    await expect(walletService.fund(USER_ID, {
      amount: 5000,
      reference: 'unique-ref-001',
    })).rejects.toMatchObject({
      statusCode: 409,
      errorCode: ErrorCode.DUPLICATE_REFERENCE,
    });
  });
});
