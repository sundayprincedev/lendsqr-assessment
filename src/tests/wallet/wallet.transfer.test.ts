import type { Knex } from 'knex';
import { ErrorCode, TransactionStatus, TransactionType } from '../../config/constants';
import { TransactionRecord } from '../../database/types';
import { UserRecord } from '../../database/types';
import { WalletRecord } from '../../database/types';
import { TransactionRepository } from '../../modules/wallet/transaction.repository';
import { WalletRepository } from '../../modules/wallet/wallet.repository';
import { WalletService } from '../../modules/wallet/wallet.service';
import { UserRepository } from '../../modules/users/user.repository';

const SENDER_USER_ID = 'sender-user-id';
const RECIPIENT_USER_ID = 'recipient-user-id';

function buildWallet(overrides: Partial<WalletRecord> = {}): WalletRecord {
  return {
    id: 'wallet-id',
    user_id: SENDER_USER_ID,
    balance: 500_000,
    currency: 'NGN',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: RECIPIENT_USER_ID,
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '08087654321',
    bvn: '10987654321',
    password_hash: 'hash',
    karma_checked_email: true,
    karma_checked_bvn: true,
    is_blacklisted: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildTransaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: 'transaction-id',
    reference: 'unique-ref-002',
    wallet_id: 'sender-wallet-id',
    type: TransactionType.TRANSFER_OUT,
    amount: 200_000,
    balance_before: 500_000,
    balance_after: 300_000,
    counterparty_wallet_id: 'recipient-wallet-id',
    status: TransactionStatus.SUCCESS,
    metadata: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('WalletService.transfer', () => {
  const walletRepository = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    updateBalance: jest.fn(),
  } as unknown as jest.Mocked<WalletRepository>;

  const transactionRepository = {
    findByReference: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<TransactionRepository>;

  const userRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;

  const transaction = jest.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
    return callback({} as Knex.Transaction);
  });

  const db = { transaction } as unknown as Knex;

  let walletService: WalletService;

  const senderWallet = buildWallet({
    id: 'sender-wallet-id',
    user_id: SENDER_USER_ID,
    balance: 500_000,
  });

  const recipientWallet = buildWallet({
    id: 'recipient-wallet-id',
    user_id: RECIPIENT_USER_ID,
    balance: 1_000_000,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    walletRepository.findByUserId.mockImplementation(async (userId) => {
      if (userId === SENDER_USER_ID) {
        return senderWallet;
      }

      if (userId === RECIPIENT_USER_ID) {
        return recipientWallet;
      }

      return undefined;
    });
    walletRepository.findById.mockImplementation(async (walletId) => {
      if (walletId === senderWallet.id) {
        return senderWallet;
      }

      if (walletId === recipientWallet.id) {
        return recipientWallet;
      }

      return undefined;
    });
    walletRepository.findByIdForUpdate.mockImplementation(async (walletId) => {
      if (walletId === senderWallet.id) {
        return senderWallet;
      }

      if (walletId === recipientWallet.id) {
        return recipientWallet;
      }

      return undefined;
    });
    walletRepository.updateBalance.mockResolvedValue();
    transactionRepository.findByReference.mockResolvedValue(undefined);
    transactionRepository.create.mockImplementation(async (data) => buildTransaction({
      reference: data.reference,
      wallet_id: data.wallet_id,
      type: data.type,
      amount: data.amount,
      balance_before: data.balance_before,
      balance_after: data.balance_after,
      counterparty_wallet_id: data.counterparty_wallet_id ?? null,
    }));
    userRepository.findByEmail.mockResolvedValue(buildUser());
    userRepository.findById.mockResolvedValue(buildUser());

    walletService = new WalletService(
      walletRepository,
      transactionRepository,
      userRepository,
      db,
    );
  });

  it('transfers funds between two wallets atomically', async () => {
    const result = await walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'jane@example.com',
      amount: 2000,
      reference: 'unique-ref-002',
    });

    expect(result.amount).toBe('2000.00');
    expect(result.recipient).toBe('Jane Doe');
    expect(result.balance_after).toBe('3000.00');
    expect(transactionRepository.create).toHaveBeenCalledTimes(2);
    expect(walletRepository.updateBalance).toHaveBeenCalledTimes(2);
  });

  it('records transfer_out and transfer_in transactions', async () => {
    await walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'jane@example.com',
      amount: 2000,
      reference: 'unique-ref-003',
    });

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.TRANSFER_OUT,
        reference: 'unique-ref-003',
      }),
      expect.anything(),
    );
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TransactionType.TRANSFER_IN,
        reference: 'unique-ref-003:in',
      }),
      expect.anything(),
    );
  });

  it('rejects when sender has insufficient balance', async () => {
    walletRepository.findByUserId.mockImplementation(async (userId) => {
      if (userId === SENDER_USER_ID) {
        return buildWallet({
          id: 'sender-wallet-id',
          user_id: SENDER_USER_ID,
          balance: 50_000,
        });
      }

      return recipientWallet;
    });

    await expect(walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'jane@example.com',
      amount: 2000,
      reference: 'unique-ref-004',
    })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: ErrorCode.INSUFFICIENT_BALANCE,
    });
  });

  it('rejects transfer to self', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ id: SENDER_USER_ID }));
    walletRepository.findByUserId.mockResolvedValue(senderWallet);

    await expect(walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'john@example.com',
      amount: 2000,
      reference: 'unique-ref-005',
    })).rejects.toMatchObject({
      statusCode: 422,
      errorCode: ErrorCode.SELF_TRANSFER,
    });
  });

  it('rejects when recipient does not exist', async () => {
    userRepository.findByEmail.mockResolvedValue(undefined);

    await expect(walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'missing@example.com',
      amount: 2000,
      reference: 'unique-ref-006',
    })).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ErrorCode.USER_NOT_FOUND,
    });
  });

  it('returns existing result for duplicate reference', async () => {
    transactionRepository.findByReference.mockResolvedValue(buildTransaction());

    const result = await walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'jane@example.com',
      amount: 2000,
      reference: 'unique-ref-002',
    });

    expect(result.reference).toBe('unique-ref-002');
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(walletRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rolls back when any step fails inside the transaction', async () => {
    transactionRepository.create
      .mockImplementationOnce(async (data) => buildTransaction({
        reference: data.reference,
        type: data.type,
      }))
      .mockRejectedValueOnce(new Error('insert failed'));

    await expect(walletService.transfer(SENDER_USER_ID, {
      recipient_email: 'jane@example.com',
      amount: 2000,
      reference: 'unique-ref-007',
    })).rejects.toThrow('insert failed');

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
