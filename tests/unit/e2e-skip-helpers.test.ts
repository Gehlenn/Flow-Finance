import { beforeEach, describe, expect, it, vi } from 'vitest';

const skipMocks = vi.hoisted(() => ({ skip: vi.fn() }));

vi.mock('@playwright/test', () => ({
  test: {
    skip: skipMocks.skip,
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

  it('writes warning to stdout when force skip is active', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await skipIf(true, { reason: 'Fixture dependente', category: 'fixture-dependent' });

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Forced execution despite: Fixture dependente'));
    expect(skipMocks.skip).not.toHaveBeenCalled();
  });

  it('writes warning when authenticated shell is missing and force shell is active', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const page = {
      getByRole: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      }),
    } as never;

    await skipIfNoAuthShell(page);

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('missing authenticated shell'));
  });

  it('writes warning when backend is unavailable and force backend is active', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const page = {} as never;

    await skipIfBackendUnavailable(page, 'api/health');

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('backend unavailability'));
  });
});
