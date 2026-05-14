import { beforeEach, describe, expect, it, vi } from 'vitest';

const skipMock = vi.fn();

vi.mock('@playwright/test', () => ({
  test: {
    skip: skipMock,
  },
}));

import {
  skipIf,
  skipIfBackendUnavailable,
  skipIfNoAuthShell,
} from '../../tests/e2e/helpers/skipHelpers';

describe('e2e skip helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('E2E_FORCE_SKIP_VERIFICATION', 'true');
    vi.stubEnv('E2E_FORCE_SHELL_VERIFICATION', 'true');
    vi.stubEnv('E2E_FORCE_BACKEND_AVAILABLE', 'true');
  });

  it('escreve aviso em stdout quando force skip esta ativo', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await skipIf(true, { reason: 'Fixture dependente', category: 'fixture-dependent' });

    expect(writeSpy).toHaveBeenCalledWith('⚠️  Forced execution despite: Fixture dependente\n');
    expect(skipMock).not.toHaveBeenCalled();
  });

  it('escreve aviso em stdout quando o shell autenticado nao aparece e force shell esta ativo', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const page = {
      getByRole: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      }),
    } as never;

    await skipIfNoAuthShell(page);

    expect(writeSpy).toHaveBeenCalledWith('⚠️  Forced execution despite missing authenticated shell\n');
  });

  it('escreve aviso em stdout quando o backend fica indisponivel e force backend esta ativo', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const page = {} as never;

    await skipIfBackendUnavailable(page, 'api/health');

    expect(writeSpy).toHaveBeenCalledWith('⚠️  Forced execution despite potential backend unavailability\n');
  });
});
