# Secret Incident Checklist

## Objective
Short operational checklist for accidental exposure of API keys, tokens, or webhook secrets.

## Immediate Actions (First 15 Minutes)
1. Revoke and rotate exposed credentials in the provider dashboard.
2. Invalidate related sessions, webhooks, and API tokens if supported.
3. Confirm no secret was committed to tracked files.
4. Remove sensitive content from local temporary files/editors.
5. Notify maintainers about scope and impacted integrations.

## Repository Verification
1. Search tracked files for secret patterns.
2. Check git history for leaked values.
3. Confirm .env and local secret files are ignored by git.
4. Replace realistic values in example env files with placeholders.

## Runtime Validation After Rotation
1. Update local env files with new values.
2. Validate auth and webhook flows in staging/local.
3. Re-run lint and impacted tests.
4. Re-run critical coverage when touching IA, finance, or shared flow.

## Stripe-Specific Steps
1. Rotate secret key and webhook signing secret.
2. Update backend env values.
3. Re-deliver webhook events (if needed) to validate signature checks.
4. Validate billing flows in mock mode and real sandbox mode.

## Prevention Baseline
1. Keep only placeholders in .env.example and .env.local.example.
2. Never paste real secrets in untitled editors or markdown docs.
3. Keep local .env files gitignored.
4. Use secret scanning in CI when possible.
