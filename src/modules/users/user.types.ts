export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  bvn: string;
  password: string;
}

export interface CreateUserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  bvn: string;
  password_hash: string;
  karma_checked_email: boolean;
  karma_checked_bvn: boolean;
  is_blacklisted: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthSession {
  user: PublicUser;
  wallet: {
    id: string;
    balance: string;
    currency: string;
  };
  token: string;
}

export type RegisterResult = AuthSession;
export type LoginResult = AuthSession;
