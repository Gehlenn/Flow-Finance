export interface UserContext {
  userId: string;
  accounts: string[];
  timezone: string;
  currency: string;
  preferences?: {
    budgetingStyle?: 'strict' | 'flexible';
    notifications?: boolean;
  };
}

export function createUserContext(input: Partial<UserContext> & { userId: string }): UserContext {
  return {
    userId: input.userId,
    accounts: input.accounts || [],
    timezone: input.timezone || 'UTC',
    currency: input.currency || 'BRL',
    preferences: input.preferences,
  };
}
