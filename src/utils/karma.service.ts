import { env } from '../config/env';
import { ErrorCode } from '../config/constants';
import { AppError } from './AppError';
import { KarmaApiResponse, KarmaCheckResult } from './karma.types';

const REQUEST_TIMEOUT_MS = 10_000;
const PLACEHOLDER_API_KEY = 'your_adjutor_api_key';

export class KarmaService {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async checkEmail(email: string): Promise<KarmaCheckResult> {
    return this.checkIdentity(email.trim().toLowerCase());
  }

  async checkBvn(bvn: string): Promise<KarmaCheckResult> {
    return this.checkIdentity(bvn.trim());
  }

  async checkIdentity(identity: string): Promise<KarmaCheckResult> {
    this.ensureApiKeyConfigured();

    const url = `${this.baseUrl}/verification/karma/${encodeURIComponent(identity)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      const body = await this.parseResponseBody(response);
      const isBlacklisted = this.resolveBlacklistStatus(response.status, body);

      return {
        identity,
        isBlacklisted,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Karma verification is temporarily unavailable',
        503,
        ErrorCode.KARMA_SERVICE_ERROR,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private ensureApiKeyConfigured(): void {
    if (!this.apiKey || this.apiKey === PLACEHOLDER_API_KEY) {
      throw new AppError(
        'Karma verification is not configured',
        503,
        ErrorCode.KARMA_SERVICE_ERROR,
      );
    }
  }

  private async parseResponseBody(response: Response): Promise<KarmaApiResponse | null> {
    const rawBody = await response.text();

    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as KarmaApiResponse;
    } catch {
      throw new AppError(
        'Karma verification returned an invalid response',
        503,
        ErrorCode.KARMA_SERVICE_ERROR,
      );
    }
  }

  private resolveBlacklistStatus(
    statusCode: number,
    body: KarmaApiResponse | null,
  ): boolean {
    if (statusCode === 404) {
      return false;
    }

    if (statusCode === 200 && body?.status === 'success' && body.data) {
      return true;
    }

    if (statusCode === 200) {
      return false;
    }

    if (statusCode === 401 || statusCode === 403) {
      throw new AppError(
        'Karma verification credentials are invalid',
        503,
        ErrorCode.KARMA_SERVICE_ERROR,
      );
    }

    throw new AppError(
      'Karma verification is temporarily unavailable',
      503,
      ErrorCode.KARMA_SERVICE_ERROR,
    );
  }
}

export function createKarmaService(
  baseUrl = env.adjutorBaseUrl,
  apiKey = env.adjutorApiKey,
): KarmaService {
  return new KarmaService(baseUrl, apiKey);
}
