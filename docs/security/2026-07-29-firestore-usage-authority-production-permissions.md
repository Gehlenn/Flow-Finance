# Firestore Usage Authority: Production Permissions

Date: 2026-07-29
Status: operational activation requirement; IAM state is not verified or changed by this repository.

## Scope

When `FIRESTORE_AI_USAGE_AUTHORITY_ENABLED=true`, the backend Admin SDK transaction in
`backend/src/services/usage/workspaceUsageAuthority.ts` reads the workspace, the current
UTC-month usage document, and an idempotency receipt. It then creates a receipt and event,
and creates or updates the usage document. The enabled metering route also lists the current
month's event subcollection. Browser clients remain denied from the internal `receipts` and
`events` subcollections by Firestore Rules.

## Minimum backend service-identity permissions

Grant the backend runtime identity only the following Firestore data-plane permissions for
the intended production database:

| Permission | Required by the authority |
| --- | --- |
| `datastore.databases.get` | Begin or roll back the Firestore transaction. |
| `datastore.entities.get` | Read the workspace, usage, and idempotency receipt. |
| `datastore.entities.list` | Query the current-month authority events for metering. |
| `datastore.entities.create` | Create the receipt/event and first monthly usage document. |
| `datastore.entities.update` | Update an existing monthly usage document in the transaction. |

The current authority does not delete these documents; `datastore.entities.delete` is not
required for this path.
Google documents the transaction and document-method permission mapping in its
[Firestore server-client IAM reference](https://cloud.google.com/firestore/native/docs/security/iam).

`roles/datastore.user` is a broader predefined fallback, not the least-privilege target: it
also grants permissions that this authority does not need. If a custom role is used, it must
contain the five permissions above and no database administration, index management, rules
deployment, IAM-policy mutation, or unrelated product-data permissions. Do not grant a
Firestore service-agent role to the application runtime identity.

## Required operational proof before activation

Before enabling the flag in production, the platform owner must record the actual runtime
service-account principal, its binding scope/conditions for the intended Firestore database,
and an IAM-policy review showing no broader conflicting role. This document is a required
permission specification only; it does **not** assert that any IAM binding has been applied.

The emulator suite `tests/firestore/workspace-usage-authority-subcollections.rules.test.ts`
proves the browser-rule boundary only. It does not validate production IAM or Admin SDK
credentials, because server SDK requests bypass Firestore Security Rules.
