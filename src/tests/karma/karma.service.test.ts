import { ErrorCode } from '../../config/constants';
import { AppError } from '../../utils/AppError';
import { KarmaService } from '../../utils/karma.service';

const BASE_URL = 'https://adjutor.lendsqr.com/v2';
const API_KEY = 'test_adjutor_api_key';

describe('KarmaService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function createService(apiKey = API_KEY): KarmaService {
    return new KarmaService(BASE_URL, apiKey);
  }

  function mockJsonResponse(status: number, body: unknown): void {
    fetchMock.mockResolvedValue({
      status,
      text: async () => JSON.stringify(body),
    });
  }

  function mockEmptyResponse(status: number): void {
    fetchMock.mockResolvedValue({
      status,
      text: async () => '',
    });
  }

  it('returns blacklisted when karma record exists', async () => {
    mockJsonResponse(200, {
      status: 'success',
      message: 'Successful',
      data: {
        karma_identity: 'john@example.com',
      },
    });

    const result = await createService().checkEmail('John@Example.com');

    expect(result).toEqual({
      identity: 'john@example.com',
      isBlacklisted: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/verification/karma/john%40example.com`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${API_KEY}`,
        }),
      }),
    );
  });

  it('returns clean when karma identity is not found', async () => {
    mockEmptyResponse(404);

    const result = await createService().checkBvn('12345678901');

    expect(result).toEqual({
      identity: '12345678901',
      isBlacklisted: false,
    });
  });

  it('returns clean when karma responds with success and no data', async () => {
    mockJsonResponse(200, {
      status: 'success',
      message: 'Not found',
    });

    const result = await createService().checkEmail('clean@example.com');

    expect(result).toEqual({
      identity: 'clean@example.com',
      isBlacklisted: false,
    });
  });

  it('throws when api key is missing', async () => {
    await expect(createService('').checkEmail('john@example.com')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when api key is still the placeholder value', async () => {
    await expect(
      createService('your_adjutor_api_key').checkBvn('12345678901'),
    ).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when karma api returns unauthorized', async () => {
    mockJsonResponse(401, {
      status: 'error',
      message: 'Unauthorized',
    });

    await expect(createService().checkEmail('john@example.com')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
  });

  it('throws when karma api returns server error', async () => {
    mockJsonResponse(500, {
      status: 'error',
      message: 'Internal server error',
    });

    await expect(createService().checkBvn('12345678901')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
  });

  it('throws when karma api returns invalid json', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      text: async () => 'not-json',
    });

    await expect(createService().checkEmail('john@example.com')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
  });

  it('throws when network request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(createService().checkEmail('john@example.com')).rejects.toBeInstanceOf(AppError);
    await expect(createService().checkEmail('john@example.com')).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });
  });

  it('throws when request times out', async () => {
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    jest.useFakeTimers();

    const pending = createService().checkEmail('john@example.com');

    jest.advanceTimersByTime(10_000);

    await expect(pending).rejects.toMatchObject({
      statusCode: 503,
      errorCode: ErrorCode.KARMA_SERVICE_ERROR,
    });

    jest.useRealTimers();
  });
});
