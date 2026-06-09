import { extractUserIdFromToken, generateAuthToken } from '../../utils/auth.token';

const AUTH_SECRET = 'test_auth_secret';
const USER_ID = '6ab0f4e9-901b-46b6-a61b-1945a2259992';

describe('auth token utils', () => {
  it('generates and extracts a valid user id', () => {
    const token = generateAuthToken(USER_ID, AUTH_SECRET);
    const extractedUserId = extractUserIdFromToken(token, AUTH_SECRET);

    expect(extractedUserId).toBe(USER_ID);
  });

  it('returns null for invalid token', () => {
    expect(extractUserIdFromToken('invalid-token', AUTH_SECRET)).toBeNull();
  });

  it('returns null when secret does not match', () => {
    const token = generateAuthToken(USER_ID, AUTH_SECRET);

    expect(extractUserIdFromToken(token, 'wrong-secret')).toBeNull();
  });
});
