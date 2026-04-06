# Security Best Practices Report

## Executive Summary

This backend review found one critical authentication flaw and two additional material hardening gaps.

- Critical: local email/password login currently authenticates any caller that provides a syntactically valid email and any non-empty password.
- High: PostgreSQL TLS is configured with certificate validation disabled in production.
- Medium: the refresh-token route has substantially weaker abuse controls than the login route.

The recently hardened clinic integration path looks materially better than the surrounding auth surface and did not produce a top-tier finding in this review slice.

## Critical Findings

### [SEC-001] Local login accepts arbitrary credentials

- Rule ID: EXPRESS-INPUT-001 / authentication bypass
- Severity: Critical
- Location: `backend/src/controllers/authController.ts:37-80`
- Evidence:

```ts
// backend/src/controllers/authController.ts:44
// For MVP: Accept any email/password (in production, hash and verify)

// backend/src/controllers/authController.ts:70
res.json({
  token: accessToken,
  accessToken,
  refreshToken: refresh.refreshToken,
  ...
});
```

- Impact: any unauthenticated attacker can mint a valid access token and refresh token for any email-shaped input without proving identity.
- Fix: replace the placeholder login flow with real identity verification against a trusted credential source, or disable `POST /api/auth/login` entirely outside test-only environments until a real verifier exists.
- Mitigation: if immediate replacement is not possible, gate the route behind a non-production-only feature flag and reject all login attempts in production/staging.
- False positive notes: none. The bypass is explicitly documented in code and directly returns signed tokens.

## High Findings

### [SEC-002] Production database TLS accepts untrusted certificates

- Rule ID: transport security / backend dependency hardening
- Severity: High
- Location: `backend/src/config/database.ts:17`, `backend/src/config/database.ts:28`
- Evidence:

```ts
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

- Impact: an attacker who can intercept traffic between the app and PostgreSQL can present an untrusted certificate and still terminate the connection, defeating server identity verification.
- Fix: enable certificate validation in production and supply the expected CA/certificate chain through environment-backed configuration.
- Mitigation: if the hosting provider requires a custom CA bundle, mount that CA explicitly instead of disabling verification.
- False positive notes: if TLS is fully terminated through a private provider mechanism outside app code, verify that this app-level connection is never exposed to a network where interception is possible.

## Medium Findings

### [SEC-003] Refresh endpoint lacks route-specific throttling comparable to login

- Rule ID: abuse controls / authentication throttling
- Severity: Medium
- Location: `backend/src/routes/auth.ts:24`, `backend/src/routes/auth.ts:46`, `backend/src/middleware/rateLimit.ts:5-12`, `backend/src/middleware/rateLimit.ts:39-42`
- Evidence:

```ts
// backend/src/routes/auth.ts:24
router.post('/login', authLimiterByUser, validate(LoginSchema), loginController);

// backend/src/routes/auth.ts:46
router.post('/refresh', optionalAuthMiddleware, refreshController);

// backend/src/middleware/rateLimit.ts:5
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
});
```

- Impact: refresh token rotation attempts are protected only by the coarse global API limiter (`100/15m` by default), while login is protected by a tighter auth-specific limiter (`5/15m`), increasing the attack budget for stolen-token replay and refresh endpoint abuse.
- Fix: add an auth-specific limiter to `POST /api/auth/refresh`, keyed by authenticated user when present and falling back to IP otherwise.
- Mitigation: log and alert on repeated refresh failures until the tighter limiter is in place.
- False positive notes: this is not a complete absence of rate limiting because the global API limiter still applies; the finding is about insufficient hardening for an auth-sensitive endpoint.

## Residual Notes

- `helmet()` is present in `backend/src/index.ts:105` and the app has custom 404/error handlers.
- The clinic integration endpoint now has edge limiting, payload limiting, HMAC validation, and authenticated health protection.
- CORS currently allows requests with no `Origin` header and sets `credentials: true` in `backend/src/config/cors.ts:40-75`. This is not elevated to a formal finding here because the real risk depends on how tokens are stored client-side and whether browser-credentialed flows are used in production.
