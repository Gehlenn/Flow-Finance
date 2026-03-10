import React, { createContext, useContext } from 'react';

export interface UserContext {
  userId: string;
  accountIds: string[];
  timezone: string;
}

const DEFAULT_USER_CONTEXT: UserContext = {
  userId: 'anonymous',
  accountIds: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

const RuntimeUserContext = createContext<UserContext>(DEFAULT_USER_CONTEXT);

export const UserContextProvider = RuntimeUserContext.Provider;

export function useUserContext(): UserContext {
  return useContext(RuntimeUserContext);
}

export function createUserContext(input: Partial<UserContext> & { userId: string }): UserContext {
  return {
    userId: input.userId,
    accountIds: input.accountIds || [],
    timezone: input.timezone || DEFAULT_USER_CONTEXT.timezone,
  };
}
