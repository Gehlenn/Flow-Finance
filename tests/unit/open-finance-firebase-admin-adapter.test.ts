// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyFirestoreSettingsOnce,
  resetFirestoreSettingsForTests,
} from '../../backend/src/services/openFinance/bankingConnectionStore';

describe('Firebase Admin Open Finance adapter', () => {
  beforeEach(() => {
    resetFirestoreSettingsForTests();
  });

  it('configura Firestore settings apenas uma vez com múltiplas inicializações', () => {
    const settings = vi.fn();
    const firestore = { settings };

    applyFirestoreSettingsOnce(firestore);
    applyFirestoreSettingsOnce(firestore);

    expect(settings).toHaveBeenCalledTimes(1);
    expect(settings).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
  });
});
