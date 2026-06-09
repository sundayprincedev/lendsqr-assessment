import { TransactionType } from '../../config/constants';

export interface FundInput {
  amount: number;
  reference: string;
}

export interface TransferInput {
  recipient_email: string;
  amount: number;
  reference: string;
}

export interface WithdrawInput {
  amount: number;
  reference: string;
}

export interface FundResult {
  transaction: {
    reference: string;
    amount: string;
    balance_before: string;
    balance_after: string;
    type: TransactionType.CREDIT;
  };
  current_balance: string;
}

export interface TransferResult {
  reference: string;
  amount: string;
  recipient: string;
  balance_before: string;
  balance_after: string;
}

export interface WithdrawResult {
  reference: string;
  amount: string;
  balance_before: string;
  balance_after: string;
}

export interface WalletResult {
  id: string;
  balance: string;
  currency: string;
  is_active: boolean;
}

export interface BalanceResult {
  balance: string;
  currency: string;
  recent_transactions: Array<{
    reference: string;
    type: TransactionType;
    amount: string;
    balance_before: string;
    balance_after: string;
    created_at: Date;
  }>;
}

export interface CreateTransactionData {
  id: string;
  reference: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  counterparty_wallet_id?: string | null;
}
