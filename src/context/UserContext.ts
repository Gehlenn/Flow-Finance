import React, { createContext, useContext } from 'react';
import { PlanName, UserRole } from '../saas';

export interface UserContext {
  userId: string;
  accountIds: string[];
  timezone: string;
  role: UserRole;
  plan: PlanName;
}

const DEFAULT_USER_CONTEXT: UserContext = {
  userId: 'anonymous',
  accountIds: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  role: 'member',
  plan: 'free',
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
    role: input.role || DEFAULT_USER_CONTEXT.role,
    plan: input.plan || DEFAULT_USER_CONTEXT.plan,
  };
}
