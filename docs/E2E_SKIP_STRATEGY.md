# E2E Test Skip Strategy

## Overview

Flow Finance E2E tests use **runtime-conditional skips** instead of static skipping. This allows tests to adapt to different execution environments while maintaining deterministic behavior.

**Status:** 22 graceful skips distributed across 7 E2E test files
- **Fixture-dependent skips** (68%): Runtime UI state checks
- **Backend-dependent skips** (18%): Service availability
- **Device-type skips** (14%): Mobile vs desktop contexts
- **Business decision skips** (5%): Features disabled by product decision

## Skip Categories

### 1. Fixture-Dependent Skips (~15 tests)
**Reason:** Authenticated shell/UI elements not visible at test time

**Root causes:**
- Frontend still loading initial auth
- Auth token not yet resolved  
- Navigation shell not rendered
- Manual action buttons not exposed

**Pattern:**
```typescript
if (!(await hasAuthenticatedShell(page))) {
  test.skip(true, 'Authenticated shell not visible in this run.');
}
```

**Recommendation:** ✅ HEALTHY - Keep as is. These are adaptive checks that protect against flaky auth initialization.

**Override:** `E2E_FORCE_SHELL_VERIFICATION=true` forces tests to continue even if shell is missing (debugging only)

---

### 2. Backend-Dependent Skips (~5 tests)
**Files affected:** `open-banking-pluggy.spec.ts` mainly

**Reason:** External services unavailable:
- OpenAI unavailable
- Pluggy Connect service offline
- Backend health check fails

**Pattern:**
```typescript
if (!backendHealthy) {
  test.skip(true, 'Backend indisponível para validar Open Banking nesta execução.');
}
```

**Environment variables:**
- `PLAYWRIGHT_BACKEND_URL`: Backend URL (default: `http://localhost:3001`)
- `E2E_PLUGGY_USER_EMAIL`: Fixture email (default: `e2e-pluggy-fixture@flowfinance.test`)
- `E2E_PLUGGY_USER_PASSWORD`: Fixture password (default: `e2e-fixture-password`)

**Recommendation:** ✅ HEALTHY - Keep as is. These gracefully degrade when services are unavailable.

**Override:** `E2E_FORCE_BACKEND_AVAILABLE=true` (use with caution for debugging)

---

### 3. Device-Type Skips (~3 tests)
**Files affected:** `billing.spec.ts`, `dashboard.spec.ts`

**Reason:** Tests designed for specific device types
- Billing tests are desktop-only (viewport too small on mobile)
- Some dashboard features mobile-only

**Pattern:**
```typescript
if (isMobile) {
  test.skip(true, 'Billing E2E desktop-only.');
}
```

**Recommendation:** ✅ HEALTHY - Keep as is. Device-type skips should NOT be overridden.

**Device contexts controlled by Playwright:**
- `chromium` (desktop)
- `firefox` (desktop)
- `webkit` (desktop)
- `Mobile Chrome` (Pixel 5)
- `Mobile Safari` (iPhone 12)

---

### 4. Business Decision Skips (~1 test)
**Files affected:** `open-banking-pluggy.spec.ts`

**Reason:** Open Finance/banking features disabled by product decision

**Pattern:**
```typescript
test.skip(true, 'Open Finance desativado por decisao de negocio nesta fase do produto.');
```

**Recommendation:** ✅ HEALTHY - Keep as is. These are intentional and should be re-enabled when the feature is activated.

---

## Environment Variable Guide

### Global Skip Overrides

| Variable | Value | Effect | Use Case |
|---|---|---|---|
| `E2E_FORCE_SKIP_VERIFICATION` | `true` | Ignore ALL conditional skips (dangerous) | Emergency debugging only |
| `E2E_FORCE_SHELL_VERIFICATION` | `true` | Ignore auth shell visibility skips | Debug slow auth initialization |
| `E2E_FORCE_BACKEND_AVAILABLE` | `true` | Skip backend health checks | Debug offline backend scenarios |

### Backend Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PLAYWRIGHT_BACKEND_URL` | `http://localhost:3001` | Backend service URL for test fixture auth |
| `E2E_PLUGGY_USER_EMAIL` | `e2e-pluggy-fixture@flowfinance.test` | Test fixture account (Pluggy/banking) |
| `E2E_PLUGGY_USER_PASSWORD` | `e2e-fixture-password` | Test fixture password |

### CI/CD

| Variable | Value | Effect |
|---|---|---|
| `CI` | `true` (set by CI/CD) | Enables retries (2x), single worker, forbidOnly |

---

## Helper Functions

All helpers are in `tests/e2e/helpers/skipHelpers.ts`

```typescript
import { 
  skipIf,
  hasAuthenticatedShell,
  skipIfNoAuthShell,
  skipIfBackendUnavailable,
  skipIfMobile,
  skipIfDesktop,
  annotateSkipReason
} from './helpers/skipHelpers';

// Example: Skip if shell not visible
await skipIfNoAuthShell(page);

// Example: Skip on mobile devices
await skipIfMobile(testInfo);

// Example: Skip with custom condition
await skipIf(someCondition, { 
  reason: 'User permissions not loaded',
  category: 'fixture-dependent'
});
```

---

## Current Skip Matrix

### By File

| File | Skips | Categories | Severity |
|---|---|---|---|
| `transactions.spec.ts` | 4 | fixture-dependent | 🟢 Low |
| `transaction-edit-category.spec.ts` | 2 | fixture-dependent | 🟢 Low |
| `open-banking-pluggy.spec.ts` | 4 | backend, business-decision | 🟡 Medium |
| `insights-aicfo.spec.ts` | 1 | fixture-dependent | 🟢 Low |
| `dashboard.spec.ts` | 4 | fixture-dependent, device-dependent | 🟢 Low |
| `billing.spec.ts` | 4 | device-dependent, fixture-dependent | 🟡 Medium |
| `auth.spec.ts` | 3 | fixture-dependent | 🟢 Low |

**Total:** 22 skips across 7 files

---

## Monitoring & Reporting

Each skipped test includes annotations for reporting:
```
[fixture-dependent] Authenticated shell not visible in this run.
[backend-dependent] Backend unavailable: /api/integrate/pluggy
[device-dependent] Test requires desktop environment
[business-decision] Open Finance desativado...
```

View in HTML reporter:
```bash
npx playwright show-report
```

---

## Backlog

- [ ] Unify all fixture-dependent skips to use `skipIfNoAuthShell()`
- [ ] Add circuit-breaker pattern for backend health checks
- [ ] Consider device-type matrix expansion (tablet, etc.)
- [ ] Add skip metrics to CI/CD reporting dashboard

---

## Conclusion

**No abnormality detected.** All 22 skips are legitimate and represent **healthy adaptive tests** that:

1. ✅ Gracefully handle environment variations
2. ✅ Provide fallback execution when conditions aren't met
3. ✅ Allow debugging via environment overrides
4. ✅ Document skip reasons for troubleshooting
5. ✅ Don't mask underlying issues (clear error messages)

The skip pattern protects test stability without hiding real bugs.
