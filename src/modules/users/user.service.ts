import bcrypt from "bcrypt";
import type { Knex } from "knex";
import { ErrorCode } from "../../config/constants";
import { getKnex } from "../../database/knex";
import { generateAuthToken } from "../../utils/auth.token";
import { AppError } from "../../utils/AppError";
import { KarmaService } from "../../utils/karma.service";
import { formatKoboAsNaira } from "../../utils/money";
import { generateId } from "../../utils/uuid";
import { WalletRepository } from "../wallet/wallet.repository";
import { UserRepository } from "./user.repository";
import {
  AuthSession,
  CreateUserData,
  LoginInput,
  RegisterInput,
  RegisterResult,
} from "./user.types";

const SALT_ROUNDS = 10;

interface KarmaAuditState {
  karma_checked_email: boolean;
  karma_checked_bvn: boolean;
}

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly walletRepository: WalletRepository,
    private readonly karmaService: KarmaService,
    private readonly authSecret: string,
    private readonly db: Knex = getKnex(),
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const normalizedInput: RegisterInput = {
      ...input,
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      bvn: input.bvn.trim(),
      name: input.name.trim(),
    };

    await this.ensureUserIsUnique(normalizedInput);

    const emailKarma = await this.karmaService.checkEmail(
      normalizedInput.email,
    );

    if (emailKarma.isBlacklisted) {
      await this.recordBlacklistedUser(normalizedInput, {
        karma_checked_email: true,
        karma_checked_bvn: false,
      });

      throw new AppError(
        "User is blacklisted and cannot be onboarded",
        403,
        ErrorCode.USER_BLACKLISTED,
      );
    }

    const bvnKarma = await this.karmaService.checkBvn(normalizedInput.bvn);

    if (bvnKarma.isBlacklisted) {
      await this.recordBlacklistedUser(normalizedInput, {
        karma_checked_email: true,
        karma_checked_bvn: true,
      });

      throw new AppError(
        "User is blacklisted and cannot be onboarded",
        403,
        ErrorCode.USER_BLACKLISTED,
      );
    }

    const passwordHash = await bcrypt.hash(
      normalizedInput.password,
      SALT_ROUNDS,
    );
    const userId = generateId();
    const walletId = generateId();

    const userData: CreateUserData = {
      id: userId,
      name: normalizedInput.name,
      email: normalizedInput.email,
      phone: normalizedInput.phone,
      bvn: normalizedInput.bvn,
      password_hash: passwordHash,
      karma_checked_email: true,
      karma_checked_bvn: true,
      is_blacklisted: false,
    };

    const result = await this.db.transaction(async (trx) => {
      const user = await this.userRepository.create(userData, trx);
      const wallet = await this.walletRepository.create(
        {
          id: walletId,
          user_id: user.id,
          balance: 0,
        },
        trx,
      );

      return { user, wallet };
    });

    return this.buildAuthSession(result.user, result.wallet);
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        401,
        ErrorCode.UNAUTHORIZED,
      );
    }

    if (user.is_blacklisted) {
      throw new AppError(
        "User is blacklisted and cannot sign in",
        403,
        ErrorCode.USER_BLACKLISTED,
      );
    }

    const passwordMatches = await bcrypt.compare(
      input.password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new AppError(
        "Invalid email or password",
        401,
        ErrorCode.UNAUTHORIZED,
      );
    }

    const wallet = await this.walletRepository.findByUserId(user.id);

    if (!wallet || !wallet.is_active) {
      throw new AppError("Wallet not found", 404, ErrorCode.WALLET_NOT_FOUND);
    }

    return this.buildAuthSession(user, wallet);
  }

  private buildAuthSession(
    user: { id: string; name: string; email: string },
    wallet: { id: string; balance: number; currency: string },
  ): AuthSession {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      wallet: {
        id: wallet.id,
        balance: formatKoboAsNaira(wallet.balance),
        currency: wallet.currency,
      },
      token: generateAuthToken(user.id, this.authSecret),
    };
  }

  private async ensureUserIsUnique(input: RegisterInput): Promise<void> {
    const existingEmail = await this.userRepository.findByEmail(input.email);

    if (existingEmail) {
      throw new AppError(
        "Email is already registered",
        409,
        ErrorCode.USER_EXISTS,
      );
    }

    const existingBvn = await this.userRepository.findByBvn(input.bvn);

    if (existingBvn) {
      throw new AppError(
        "BVN is already registered",
        409,
        ErrorCode.USER_EXISTS,
      );
    }

    const existingPhone = await this.userRepository.findByPhone(input.phone);

    if (existingPhone) {
      throw new AppError(
        "Phone number is already registered",
        409,
        ErrorCode.USER_EXISTS,
      );
    }
  }

  private async recordBlacklistedUser(
    input: RegisterInput,
    karmaState: KarmaAuditState,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    await this.userRepository.create({
      id: generateId(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      bvn: input.bvn,
      password_hash: passwordHash,
      karma_checked_email: karmaState.karma_checked_email,
      karma_checked_bvn: karmaState.karma_checked_bvn,
      is_blacklisted: true,
    });
  }
}
