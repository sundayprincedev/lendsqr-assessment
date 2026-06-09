declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
