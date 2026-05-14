import { describe, it, expect, afterEach, vi } from 'vitest';
import { AuthService } from './authService';

const loggerWarnMock = vi.fn();

vi.mock('../config/logger', () => ({
  default: {
    warn: (...args: unknown[]) => loggerWarnMock(...args),
  },
}));

describe('AuthService', () => {
  it('deve instanciar o serviço', () => {
    const service = new AuthService();
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('retorna usuário com id derivado do email em ambiente de teste', async () => {
      process.env.NODE_ENV = 'test';
      const user = await AuthService.login('user@example.com', 'qualquer-senha');
      expect(user.email).toBe('user@example.com');
      expect(user.id).toMatch(/^usr_/);
      expect(user.passwordHash).toBe('external-auth');
    });

    it('retorna usuário em ambiente de desenvolvimento', async () => {
      process.env.NODE_ENV = 'development';
      const user = await AuthService.login('dev@flow.com', 'senha');
      expect(user.email).toBe('dev@flow.com');
    });

    it('lança erro em ambiente de produção (defense-in-depth)', async () => {
      process.env.NODE_ENV = 'production';
      await expect(AuthService.login('admin@flow.com', 'senha')).rejects.toThrow(
        'AuthService.login stub must not be called in production',
      );
    });
  });

  describe('register', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      loggerWarnMock.mockClear();
    });

    it('registra um aviso controlado fora de producao', async () => {
      process.env.NODE_ENV = 'development';

      await expect(AuthService.register({
        id: 'usr_1',
        email: 'user@example.com',
        passwordHash: 'external-auth',
        tenantId: 'tenant-1',
      })).resolves.toBeUndefined();

      expect(loggerWarnMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_1',
          email: 'user@example.com',
          tenantId: 'tenant-1',
          fallback: 'auth-register-stub-noop',
        }),
        'AuthService.register is a controlled no-op outside production',
      );
    });

    it('lança erro em producao', async () => {
      process.env.NODE_ENV = 'production';

      await expect(AuthService.register({
        id: 'usr_1',
        email: 'user@example.com',
        passwordHash: 'external-auth',
        tenantId: 'tenant-1',
      })).rejects.toThrow('AuthService.register stub must not be called in production');
    });
  });
});

