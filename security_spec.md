# Security Spec & TDD Matrix

## 1. Data Invariants
1. Identity Integrity: Every document written (`expenses`, `clients`, `orders`, `machinery`, `services`, `companies`) MUST have `userId == request.auth.uid`.
2. Anti-Update-Gap: User cannot forge, inject, or tamper with foreign `userId`s or escalate privileges.
3. Size & Type Enforcements: All strings have explicit `.size()` boundaries (e.g. `<= 300` for descriptions, `<= 128` for IDs) to prevent resource exhaustion.
4. Terminal State & Valid ID: Document IDs in path matches must satisfy `isValidId(id)` (`matches('^[a-zA-Z0-9_\\-]+$')`).
5. Role verification: Admin operations require verified admin privilege checked against `/databases/$(database)/documents/admins/$(request.auth.uid)` or authenticated matching admin email (`alisson3pagotto@gmail.com`).
6. Zero Blanket Queries: All list operations require `resource.data.userId == request.auth.uid` or admin access.

## 2. The Dirty Dozen Payloads
1. **Unauthenticated Write**: Creating an expense without any auth token (`request.auth == null`).
2. **Identity Spoofing**: User `user_abc` attempts to create an expense setting `"userId": "user_xyz"`.
3. **Foreign Document Takeover**: User `user_abc` attempts to update or delete a client belonging to `user_xyz`.
4. **ID Poisoning Attack**: Attempt to create an expense with a 2MB junk string as `expenseId`.
5. **Denial-of-Wallet Payload**: Creating an expense with a 500,000 character description exceeding string bounds.
6. **Negative Amount Tampering**: Writing invalid negative numbers or malformed types in `amount`.
7. **Blanket Query Scraping**: Attempting to list `/expenses` without filtering by user's own `userId`.
8. **Privilege Escalation**: Non-admin user writing directly to `/admins/{adminId}` to grant themselves admin status.
9. **Ghost Field Injection**: Attempting an update that injects unauthorized shadow keys.
10. **Company Profile Hijack**: Modifying company profile where `resource.data.userId != request.auth.uid`.
11. **Unverified Email Bypass**: Writing sensitive enterprise records while `request.auth.token.email_verified == false`.
12. **Immutable Field Tampering**: Updating an expense attempting to mutate the original `userId` or `id`.

## 3. Test Runner Specification
All twelve dirty dozen attack vectors must evaluate to `PERMISSION_DENIED`.
