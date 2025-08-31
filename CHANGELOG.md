Changelog

All notable changes to this project will be documented in this file.

2025-08-31

- Changed: Refactor `updatePaymentStatus` in `src/server/repositories/payments.js` to use an options-object signature for clarity and future-proofing.
  - New signature: `updatePaymentStatus(trackingId, status, method, { confirmationCode, statusDescription })`
  - Rationale: Removes ambiguity of prior positional `arg4`/`arg5` parameters and makes intent explicit.
  - Behavior: Repository always forwards five arguments to `@/lib/db.updatePaymentStatus`.
  - Impact: Update call sites to pass the fourth parameter as an object.
    - Example before: `updatePaymentStatus(tid, status, method, confirmationCode, statusDescription)`
    - Example after: `updatePaymentStatus(tid, status, method, { confirmationCode, statusDescription })`
    - If no confirmation code: `updatePaymentStatus(tid, status, method, { statusDescription })`
- Updated: Service usages in `src/server/services/payments.js` to the new signature.
- Updated: Tests to assert the five-argument call at the DB layer while using the repository’s options object.

