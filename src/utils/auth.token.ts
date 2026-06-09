export function generateAuthToken(userId: string, secret: string): string {
  return Buffer.from(`${userId}:${secret}`).toString('base64');
}

export function extractUserIdFromToken(token: string, secret: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    const userId = decoded.slice(0, separatorIndex);
    const tokenSecret = decoded.slice(separatorIndex + 1);

    if (!userId || tokenSecret !== secret) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}
