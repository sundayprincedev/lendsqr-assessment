import { TransactionStatus, TransactionType } from '../config/constants';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  bvn: string;
  password_hash: string;
  karma_checked_email: boolean;
  karma_checked_bvn: boolean;
  is_blacklisted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WalletRecord {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionRecord {
  id: string;
  reference: string;
  wallet_id: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  counterparty_wallet_id: string | null;
  status: TransactionStatus;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}
