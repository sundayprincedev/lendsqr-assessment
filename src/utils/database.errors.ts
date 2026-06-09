interface DatabaseError {
  code?: string;
}

export function isDuplicateEntryError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as DatabaseError).code === 'ER_DUP_ENTRY';
}
