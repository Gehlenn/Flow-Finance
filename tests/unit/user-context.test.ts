import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUserContext, ReactUserContextProvider, useUserContext } from '../../src/context/UserContext';
import { createUserContext as createStructuredContext } from '../../src/context/UserContext/UserContext';

function ReadCurrency() {
  const context = useUserContext();
  return React.createElement('span', null, `${context.userId}:${context.currency}:${context.accounts.length}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UserContext factories', () => {
  it('createUserContext applies defaults for timezone and currency', () => {
    const context = createUserContext({ userId: 'u1' });

    expect(context.userId).toBe('u1');
    expect(context.currency).toBe('BRL');
    expect(context.timezone).toBeTruthy();
    expect(Array.isArray(context.accounts)).toBe(true);
  });

  it('createUserContext keeps provided values', () => {
    const context = createUserContext({
      userId: 'u1',
      timezone: 'America/Sao_Paulo',
      currency: 'USD',
      accounts: ['acc-1'],
    });

    expect(context.timezone).toBe('America/Sao_Paulo');
    expect(context.currency).toBe('USD');
    expect(context.accounts).toEqual(['acc-1']);
  });

  it('createStructuredContext sets fallback values and preferences', () => {
    const context = createStructuredContext({
      userId: 'u2',
      preferences: { budgetingStyle: 'strict', notifications: true },
    });

    expect(context.timezone).toBe('UTC');
    expect(context.currency).toBe('BRL');
    expect(context.preferences?.budgetingStyle).toBe('strict');
    expect(context.preferences?.notifications).toBe(true);
  });

  it('useUserContext retorna defaults quando nao ha provider', () => {
    render(React.createElement(ReadCurrency));

    expect(screen.getByText(/^anonymous:BRL:0$/)).toBeTruthy();
  });

  it('useUserContext consome valores do provider em runtime', () => {
    render(
      React.createElement(
        ReactUserContextProvider,
        {
          value: createUserContext({
            userId: 'u-provider',
            currency: 'USD',
            accounts: ['acc-1', 'acc-2'],
          }),
        },
        React.createElement(ReadCurrency),
      ),
    );

    expect(screen.getByText(/^u-provider:USD:2$/)).toBeTruthy();
  });

  it('createUserContext usa UTC quando timezone do runtime nao existe', async () => {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    const dateTimeFormatSpy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((...args: any[]) => {
      const formatter = new OriginalDateTimeFormat(...args);
      return {
        ...formatter,
        resolvedOptions: () => ({
          ...formatter.resolvedOptions(),
          timeZone: '',
        }),
      } as Intl.DateTimeFormat;
    });

    vi.resetModules();
    const { createUserContext: createRuntimeContext } = await import('../../src/context/UserContext');
    const context = createRuntimeContext({ userId: 'u-fallback-timezone' });

    expect(context.timezone).toBe('UTC');
    dateTimeFormatSpy.mockRestore();
  });
});