# Multer Dependency Security Review - 2026-06-26

## Scope

This review closes the open Dependabot PR `#53`, `chore(deps): bump multer and @types/multer in /backend`, as a repo-specific risk assessment instead of accepting a stale major dependency bump blindly.

## Evidence Checked

- GitHub PR `#53` was still open, mergeable, and last updated on 2026-06-02. Its checks were stale and failing from 2026-05-05.
- The PR proposed `multer` `1.4.5-lts.2 -> 2.1.1` and `@types/multer` `1.4.13 -> 2.1.0`.
- Current npm registry metadata reports `multer` latest as `2.2.0`; the PR target is no longer current.
- Targeted source search found no `multer`, `Multer`, `upload.single`, `upload.array`, `upload.fields`, `busboy`, or `multipart/form-data` usage under:
  - `backend/src`
  - `backend/tests`
  - `backend/scripts`
- `backend/src/index.ts` registers JSON/urlencoded Express parsers and route modules, but no multipart upload middleware.

## Conclusion

`multer` is not reachable in the current backend request paths. There is no active multipart upload endpoint in the audited backend surface, so the vulnerable package is not an exposed runtime parser today.

The real risk is dependency hygiene: `multer` was declared as a production dependency even though the backend does not use it. Keeping an unused file-upload parser in a financial backend creates unnecessary future attack surface and keeps security automation noisy.

## Decision

Remove `multer` and `@types/multer` instead of upgrading to the stale Dependabot target.

This is safer than accepting PR `#53` because:

- no current code imports the package;
- no upload behavior needs a compatibility-preserving major migration;
- removing the package reduces production dependency surface;
- future upload work must make the route, limits, storage, validation, and serving model explicit before reintroducing a multipart parser.

## Regression Coverage

Added `backend/tests/unit/dependency-surface-security.test.ts`.

The test asserts:

- `backend/package.json` does not ship `multer`;
- `backend/package.json` does not ship `@types/multer`;
- runtime backend source/scripts contain no upload parser references.

## Validation

- `rg -n -i "multer|multipart/form-data|busboy" backend/src backend/scripts backend/tests` found no runtime backend usage outside this test file.
- `npx vitest run --pool=threads backend/tests/unit/dependency-surface-security.test.ts` passed: 1 file, 1 test.
- The default forks worker path timed out in this shell, so the thread pool was used for explicit validation of this isolated file.

If a future feature intentionally adds file uploads, this test should fail until the implementation includes an explicit secure upload design.

## Follow-Up

Close Dependabot PR `#53` after this branch lands, with this review as the reason. Do not merge the stale dependency-bump PR.

Residual `npm audit` findings remain outside this review and should be triaged separately; they are not caused by `multer`.
