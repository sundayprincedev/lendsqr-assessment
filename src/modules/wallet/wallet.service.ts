import type { Knex } from 'knex';
import { ErrorCode, TransactionType } from '../../config/constants';
import { getKnex } from '../../database/knex';
import { TransactionRecord, WalletRecord } from '../../database/types';
import { isDuplicateEntryError } from '../../utils/database.errors';
import { AppError } from '../../utils/AppError';
import { formatKoboAsNaira, nairaToKobo } from '../../utils/money';
import { generateId } from '../../utils/uuid';
import { UserRepository } from '../users/user.repository';
import { TransactionRepository } from './transaction.repository';
import {
  BalanceResult,
  WalletResult,
  FundInput,
  FundResult,
  TransferInput,
  TransferResult,
  WithdrawInput,
  WithdrawResult,
} from './wallet.types';
import { WalletRepository } from './wallet.repository';

const RECENT_TRANSACTION_LIMIT = 10;

export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly userRepository: UserRepository,
    private readonly db: Knex = getKnex(),
  ) {}

  async fund(userId: string, input: FundInput): Promise<FundResult> {
    const amountKobo = nairaToKobo(input.amount);
    const wallet = await this.getActiveWalletByUserId(userId);

    const existing = await this.transactionRepository.findByReference(input.reference);

    if (existing) {
      return this.buildFundResultFromExisting(wallet.id, existing);
    }

    const transaction = await this.runFundTransaction(userId, input.reference, amountKobo, wallet.id);

    return this.mapFundResult(
      input.reference,
      transaction,
      this.toKobo(transaction.balance_after),
    );
  }

  async transfer(userId: string, input: TransferInput): Promise<TransferResult> {
    const amountKobo = nairaToKobo(input.amount);
    const senderWallet = await this.getActiveWalletByUserId(userId);

    const existing = await this.transactionRepository.findByReference(input.reference);

    if (existing) {
      return this.buildTransferResultFromExisting(senderWallet.id, existing);
    }

    const recipient = await this.userRepository.findByEmail(input.recipient_email);

    if (!recipient) {
      throw new AppError('Recipient not found', 404, ErrorCode.USER_NOT_FOUND);
    }

    const recipientWallet = await this.walletRepository.findByUserId(recipient.id);

    if (!recipientWallet || !recipientWallet.is_active) {
      throw new AppError('Recipient wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
    }

    if (senderWallet.id === recipientWallet.id) {
      throw new AppError('Cannot transfer to your own wallet', 422, ErrorCode.SELF_TRANSFER);
    }

    const senderBalance = this.toKobo(senderWallet.balance);

    if (senderBalance < amountKobo) {
      throw new AppError('Insufficient wallet balance', 400, ErrorCode.INSUFFICIENT_BALANCE);
    }

    const senderBalanceAfter = senderBalance - amountKobo;
    const inboundReference = `${input.reference}:in`;

    try {
      await this.db.transaction(async (trx) => {
        const lockedSenderWallet = await this.walletRepository.findByIdForUpdate(senderWallet.id, trx);
        const lockedRecipientWallet = await this.walletRepository.findByIdForUpdate(
          recipientWallet.id,
          trx,
        );

        if (!lockedSenderWallet || !lockedRecipientWallet) {
          throw new AppError('Wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
        }

        const currentSenderBalance = this.toKobo(lockedSenderWallet.balance);

        if (currentSenderBalance < amountKobo) {
          throw new AppError('Insufficient wallet balance', 400, ErrorCode.INSUFFICIENT_BALANCE);
        }

        const nextSenderBalance = currentSenderBalance - amountKobo;
        const currentRecipientBalance = this.toKobo(lockedRecipientWallet.balance);
        const nextRecipientBalance = currentRecipientBalance + amountKobo;

        await this.transactionRepository.create(
          {
            id: generateId(),
            reference: input.reference,
            wallet_id: lockedSenderWallet.id,
            type: TransactionType.TRANSFER_OUT,
            amount: amountKobo,
            balance_before: currentSenderBalance,
            balance_after: nextSenderBalance,
            counterparty_wallet_id: lockedRecipientWallet.id,
          },
          trx,
        );

        await this.transactionRepository.create(
          {
            id: generateId(),
            reference: inboundReference,
            wallet_id: lockedRecipientWallet.id,
            type: TransactionType.TRANSFER_IN,
            amount: amountKobo,
            balance_before: currentRecipientBalance,
            balance_after: nextRecipientBalance,
            counterparty_wallet_id: lockedSenderWallet.id,
          },
          trx,
        );

        await this.walletRepository.updateBalance(lockedSenderWallet.id, nextSenderBalance, trx);
        await this.walletRepository.updateBalance(lockedRecipientWallet.id, nextRecipientBalance, trx);
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const duplicate = await this.transactionRepository.findByReference(input.reference);

        if (duplicate) {
          return this.buildTransferResultFromExisting(senderWallet.id, duplicate);
        }

        throw new AppError(
          'Transaction reference already exists',
          409,
          ErrorCode.DUPLICATE_REFERENCE,
        );
      }

      throw error;
    }

    return {
      reference: input.reference,
      amount: formatKoboAsNaira(amountKobo),
      recipient: recipient.name,
      balance_before: formatKoboAsNaira(senderBalance),
      balance_after: formatKoboAsNaira(senderBalanceAfter),
    };
  }

  async withdraw(userId: string, input: WithdrawInput): Promise<WithdrawResult> {
    const amountKobo = nairaToKobo(input.amount);
    const wallet = await this.getActiveWalletByUserId(userId);

    const existing = await this.transactionRepository.findByReference(input.reference);

    if (existing) {
      return this.buildWithdrawResultFromExisting(wallet.id, existing);
    }

    if (this.toKobo(wallet.balance) < amountKobo) {
      throw new AppError('Insufficient wallet balance', 400, ErrorCode.INSUFFICIENT_BALANCE);
    }

    const transaction = await this.runWithdrawTransaction(
      userId,
      input.reference,
      amountKobo,
      wallet.id,
    );

    return this.mapWithdrawResult(
      input.reference,
      transaction,
      this.toKobo(transaction.balance_before),
      this.toKobo(transaction.balance_after),
    );
  }

  async getWallet(userId: string): Promise<WalletResult> {
    const wallet = await this.getActiveWalletByUserId(userId);

    return {
      id: wallet.id,
      balance: formatKoboAsNaira(this.toKobo(wallet.balance)),
      currency: wallet.currency,
      is_active: wallet.is_active,
    };
  }

  async getBalance(userId: string): Promise<BalanceResult> {
    const wallet = await this.getActiveWalletByUserId(userId);
    const transactions = await this.transactionRepository.findRecentByWalletId(
      wallet.id,
      RECENT_TRANSACTION_LIMIT,
    );

    return {
      balance: formatKoboAsNaira(this.toKobo(wallet.balance)),
      currency: wallet.currency,
      recent_transactions: transactions.map((transaction) => ({
        reference: this.publicReference(transaction.reference),
        type: transaction.type,
        amount: formatKoboAsNaira(this.toKobo(transaction.amount)),
        balance_before: formatKoboAsNaira(this.toKobo(transaction.balance_before)),
        balance_after: formatKoboAsNaira(this.toKobo(transaction.balance_after)),
        created_at: transaction.created_at,
      })),
    };
  }

  private async runFundTransaction(
    userId: string,
    reference: string,
    amountKobo: number,
    walletId: string,
  ): Promise<TransactionRecord> {
    try {
      return await this.db.transaction(async (trx) => {
        const lockedWallet = await this.walletRepository.findByUserIdForUpdate(userId, trx);

        if (!lockedWallet || !lockedWallet.is_active) {
          throw new AppError('Wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
        }

        const currentBalance = this.toKobo(lockedWallet.balance);
        const nextBalance = currentBalance + amountKobo;

        const createdTransaction = await this.transactionRepository.create(
          {
            id: generateId(),
            reference,
            wallet_id: lockedWallet.id,
            type: TransactionType.CREDIT,
            amount: amountKobo,
            balance_before: currentBalance,
            balance_after: nextBalance,
          },
          trx,
        );

        await this.walletRepository.updateBalance(lockedWallet.id, nextBalance, trx);

        return createdTransaction;
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const duplicate = await this.transactionRepository.findByReference(reference);

        if (duplicate) {
          return this.resolveExistingTransaction(walletId, duplicate, TransactionType.CREDIT);
        }

        throw new AppError(
          'Transaction reference already exists',
          409,
          ErrorCode.DUPLICATE_REFERENCE,
        );
      }

      throw error;
    }
  }

  private async runWithdrawTransaction(
    userId: string,
    reference: string,
    amountKobo: number,
    walletId: string,
  ): Promise<TransactionRecord> {
    try {
      return await this.db.transaction(async (trx) => {
        const lockedWallet = await this.walletRepository.findByUserIdForUpdate(userId, trx);

        if (!lockedWallet || !lockedWallet.is_active) {
          throw new AppError('Wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
        }

        const currentBalance = this.toKobo(lockedWallet.balance);

        if (currentBalance < amountKobo) {
          throw new AppError('Insufficient wallet balance', 400, ErrorCode.INSUFFICIENT_BALANCE);
        }

        const nextBalance = currentBalance - amountKobo;

        const createdTransaction = await this.transactionRepository.create(
          {
            id: generateId(),
            reference,
            wallet_id: lockedWallet.id,
            type: TransactionType.DEBIT,
            amount: amountKobo,
            balance_before: currentBalance,
            balance_after: nextBalance,
          },
          trx,
        );

        await this.walletRepository.updateBalance(lockedWallet.id, nextBalance, trx);

        return createdTransaction;
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        const duplicate = await this.transactionRepository.findByReference(reference);

        if (duplicate) {
          return this.resolveExistingTransaction(walletId, duplicate, TransactionType.DEBIT);
        }

        throw new AppError(
          'Transaction reference already exists',
          409,
          ErrorCode.DUPLICATE_REFERENCE,
        );
      }

      throw error;
    }
  }

  private resolveExistingTransaction(
    walletId: string,
    transaction: TransactionRecord,
    type: TransactionType,
  ): TransactionRecord {
    this.assertMatchingTransaction(walletId, transaction, type);
    return transaction;
  }

  private async getActiveWalletByUserId(userId: string): Promise<WalletRecord> {
    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet || !wallet.is_active) {
      throw new AppError('Wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
    }

    return wallet;
  }

  private buildFundResultFromExisting(
    walletId: string,
    transaction: TransactionRecord,
  ): FundResult {
    this.assertMatchingTransaction(
      walletId,
      transaction,
      TransactionType.CREDIT,
    );

    return this.mapFundResult(
      transaction.reference,
      transaction,
      this.toKobo(transaction.balance_after),
    );
  }

  private buildWithdrawResultFromExisting(
    walletId: string,
    transaction: TransactionRecord,
  ): WithdrawResult {
    this.assertMatchingTransaction(
      walletId,
      transaction,
      TransactionType.DEBIT,
    );

    return this.mapWithdrawResult(
      transaction.reference,
      transaction,
      this.toKobo(transaction.balance_before),
      this.toKobo(transaction.balance_after),
    );
  }

  private async buildTransferResultFromExisting(
    senderWalletId: string,
    transaction: TransactionRecord,
  ): Promise<TransferResult> {
    this.assertMatchingTransaction(
      senderWalletId,
      transaction,
      TransactionType.TRANSFER_OUT,
    );

    if (!transaction.counterparty_wallet_id) {
      throw new AppError('Transaction reference already exists', 409, ErrorCode.DUPLICATE_REFERENCE);
    }

    const recipientWallet = await this.walletRepository.findById(transaction.counterparty_wallet_id);

    if (!recipientWallet) {
      throw new AppError('Recipient wallet not found', 404, ErrorCode.WALLET_NOT_FOUND);
    }

    const recipient = await this.userRepository.findById(recipientWallet.user_id);

    if (!recipient) {
      throw new AppError('Recipient not found', 404, ErrorCode.USER_NOT_FOUND);
    }

    return {
      reference: transaction.reference,
      amount: formatKoboAsNaira(this.toKobo(transaction.amount)),
      recipient: recipient.name,
      balance_before: formatKoboAsNaira(this.toKobo(transaction.balance_before)),
      balance_after: formatKoboAsNaira(this.toKobo(transaction.balance_after)),
    };
  }

  private assertMatchingTransaction(
    walletId: string,
    transaction: TransactionRecord,
    type: TransactionType,
  ): void {
    if (transaction.wallet_id !== walletId || transaction.type !== type) {
      throw new AppError('Transaction reference already exists', 409, ErrorCode.DUPLICATE_REFERENCE);
    }
  }

  private mapFundResult(
    reference: string,
    transaction: TransactionRecord,
    currentBalance: number,
  ): FundResult {
    return {
      transaction: {
        reference,
        amount: formatKoboAsNaira(this.toKobo(transaction.amount)),
        balance_before: formatKoboAsNaira(this.toKobo(transaction.balance_before)),
        balance_after: formatKoboAsNaira(this.toKobo(transaction.balance_after)),
        type: TransactionType.CREDIT,
      },
      current_balance: formatKoboAsNaira(currentBalance),
    };
  }

  private mapWithdrawResult(
    reference: string,
    transaction: TransactionRecord,
    balanceBefore: number,
    balanceAfter: number,
  ): WithdrawResult {
    return {
      reference,
      amount: formatKoboAsNaira(this.toKobo(transaction.amount)),
      balance_before: formatKoboAsNaira(balanceBefore),
      balance_after: formatKoboAsNaira(balanceAfter),
    };
  }

  private publicReference(reference: string): string {
    return reference.endsWith(':in') ? reference.slice(0, -3) : reference;
  }

  private toKobo(value: number | string): number {
    return Number(value);
  }
}
