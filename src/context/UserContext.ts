import React, { createContext, useContext } from 'react';
import { UserContext, createUserContext as createStructuredUserContext } from './UserContext/UserContext';

const DEFAULT_USER_CONTEXT: UserContext = {
  userId: 'anonymous',
  accounts: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  currency: 'BRL',
};

const RuntimeUserContext = createContext<UserContext>(DEFAULT_USER_CONTEXT);

export const ReactUserContextProvider = RuntimeUserContext.Provider;

export function useUserContext(): UserContext {
  return useContext(RuntimeUserContext);
}

export function createUserContext(input: Partial<UserContext> & { userId: string }): UserContext {
  return createStructuredUserContext({
    ...input,
    timezone: input.timezone || DEFAULT_USER_CONTEXT.timezone,
    currency: input.currency || DEFAULT_USER_CONTEXT.currency,
  });
}

export type { UserContext } from './UserContext/UserContext';
