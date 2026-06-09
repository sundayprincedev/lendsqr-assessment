import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import { ErrorCode } from '../../config/constants';
import { UserRecord } from '../../database/types';
import { WalletRecord } from '../../database/types';
import { AppError } from '../../utils/AppError';
import { KarmaService } from '../../utils/karma.service';
import { WalletRepository } from '../../modules/wallet/wallet.repository';
import { UserRepository } from '../../modules/users/user.repository';
import { UserService } from '../../modules/users/user.service';
import { RegisterInput } from '../../modules/users/user.types';

const AUTH_SECRET = 'test_auth_secret';

const registerInput: RegisterInput = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '08012345678',
  bvn: '12345678901',
  password: 'SecurePass123!',
};

function buildUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-id',
    name: registerInput.name,
    email: registerInput.email,
    phone: registerInput.phone,
    bvn: registerInput.bvn,
    password_hash: 'hashed-password',
    karma_checked_email: true,
    karma_checked_bvn: true,
    is_blacklisted: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildWallet(overrides: Partial<WalletRecord> = {}): WalletRecord {
  return {
    id: 'wallet-id',
    user_id: 'user-id',
    balance: 0,
    currency: 'NGN',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('UserService', () => {
  const userRepository = {
    findByEmail: jest.fn(),
    findByBvn: jest.fn(),
    findByPhone: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;

  const walletRepository = {
    findByUserId: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<WalletRepository>;

  const karmaService = {
    checkEmail: jest.fn(),
    checkBvn: jest.fn(),
    checkIdentity: jest.fn(),
  } as unknown as jest.Mocked<KarmaService>;

  const transaction = jest.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) => {
    return callback({} as Knex.Transaction);
  });

  const db = {
    transaction,
  } as unknown as Knex;

  let userService: UserService;

  beforeEach(() => {
    jest.clearAllMocks();

    userRepository.findByEmail.mockResolvedValue(undefined);
    userRepository.findByBvn.mockResolvedValue(undefined);
    userRepository.findByPhone.mockResolvedValue(undefined);
    userRepository.create.mockImplementation(async (data) => buildUser({
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      bvn: data.bvn,
      password_hash: data.password_hash,
      karma_checked_email: data.karma_checked_email,
      karma_checked_bvn: data.karma_checked_bvn,
      is_blacklisted: data.is_blacklisted,
    }));
    walletRepository.create.mockImplementation(async (data) => buildWallet({
      id: data.id,
      user_id: data.user_id,
      balance: data.balance ?? 0,
    }));
    karmaService.checkEmail.mockResolvedValue({
      identity: registerInput.email,
      isBlacklisted: false,
    });
    karmaService.checkBvn.mockResolvedValue({
      identity: registerInput.bvn,
      isBlacklisted: false,
    });

    userService = new UserService(
      userRepository,
      walletRepository,
      karmaService,
      AUTH_SECRET,
      db,
    );
  });

  it('creates a user and wallet when email and bvn are clean', async () => {
    const result = await userService.register(registerInput);

    expect(karmaService.checkEmail).toHaveBeenCalledWith(registerInput.email);
    expect(karmaService.checkBvn).toHaveBeenCalledWith(registerInput.bvn);
    expect(userRepository.create).toHaveBeenCalledTimes(1);
    expect(walletRepository.create).toHaveBeenCalledTimes(1);
    expect(result.user.email).toBe(registerInput.email);
    expect(result.wallet.balance).toBe('0.00');
    expect(result.wallet.currency).toBe('NGN');
    expect(result.token).toBeTruthy();
  });

  it('rejects user when email is blacklisted', async () => {
    karmaService.checkEmail.mockResolvedValue({
      identity: registerInput.email,
      isBlacklisted: true,
    });

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ErrorCode.USER_BLACKLISTED,
    });

    expect(karmaService.checkBvn).not.toHaveBeenCalled();
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        is_blacklisted: true,
        karma_checked_email: true,
        karma_checked_bvn: false,
      }),
    );
    expect(walletRepository.create).not.toHaveBeenCalled();
  });

  it('rejects user when bvn is blacklisted', async () => {
    karmaService.checkBvn.mockResolvedValue({
      identity: registerInput.bvn,
      isBlacklisted: true,
    });

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ErrorCode.USER_BLACKLISTED,
    });

    expect(karmaService.checkEmail).toHaveBeenCalled();
    expect(karmaService.checkBvn).toHaveBeenCalled();
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        is_blacklisted: true,
        karma_checked_email: true,
        karma_checked_bvn: true,
      }),
    );
    expect(walletRepository.create).not.toHaveBeenCalled();
  });

  it('rejects user when email already exists', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser());

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: ErrorCode.USER_EXISTS,
    });

    expect(karmaService.checkEmail).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('rejects user when bvn already exists', async () => {
    userRepository.findByBvn.mockResolvedValue(buildUser());

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: ErrorCode.USER_EXISTS,
    });

    expect(karmaService.checkEmail).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('rejects user when phone already exists', async () => {
    userRepository.findByPhone.mockResolvedValue(buildUser());

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: ErrorCode.USER_EXISTS,
    });

    expect(karmaService.checkEmail).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('fails closed when karma api is unreachable', async () => {
    karmaService.checkEmail.mockRejectedValue(
      new AppError('Karma verification is temporarily unavailable', 503, ErrorCode.KARMA_SERVICE_ERROR),
    );

    await expect(userService.register(registerInput)).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(walletRepository.create).not.toHaveBeenCalled();
  });
});

describe('UserService.login', () => {
  const userRepository = {
    findByEmail: jest.fn(),
    findByBvn: jest.fn(),
    findByPhone: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<UserRepository>;

  const walletRepository = {
    findByUserId: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<WalletRepository>;

  const karmaService = {} as unknown as jest.Mocked<KarmaService>;

  const db = { transaction: jest.fn() } as unknown as Knex;

  const userService = new UserService(
    userRepository,
    walletRepository,
    karmaService,
    AUTH_SECRET,
    db,
  );

  const loginInput = {
    email: 'john@example.com',
    password: 'SecurePass123!',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository.findByEmail.mockResolvedValue(buildUser());
    walletRepository.findByUserId.mockResolvedValue(buildWallet());
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
  });

  it('returns token when credentials are valid', async () => {
    const result = await userService.login(loginInput);

    expect(result.user.email).toBe(loginInput.email);
    expect(result.wallet.balance).toBe('0.00');
    expect(result.token).toBeTruthy();
  });

  it('rejects unknown email', async () => {
    userRepository.findByEmail.mockResolvedValue(undefined);

    await expect(userService.login(loginInput)).rejects.toMatchObject({
      statusCode: 401,
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('rejects invalid password', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(userService.login(loginInput)).rejects.toMatchObject({
      statusCode: 401,
      errorCode: ErrorCode.UNAUTHORIZED,
    });
  });

  it('rejects blacklisted user', async () => {
    userRepository.findByEmail.mockResolvedValue(buildUser({ is_blacklisted: true }));

    await expect(userService.login(loginInput)).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ErrorCode.USER_BLACKLISTED,
    });
  });
});
