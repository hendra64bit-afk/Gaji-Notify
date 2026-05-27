# Security Specification: Kepegawaian App Firestore

## 1. Data Invariants
1. An employee record (`Employee`) belongs to exactly one owner (manager UID).
2. The `ownerId` of the employee record must match the authenticated user's UID (`request.auth.uid`).
3. An employee database contains NIP (18-character numeric pattern), Name, Birth Date, Current Rank, and list of child dependencies.
4. Timestamps `createdAt` and `updatedAt` are secured by server-assigned times.
5. Users can only read, write, update, or delete employee documents that they own (`resource.data.ownerId == request.auth.uid`).

## 2. Dirty Dozen Payloads (Negative Tests Validation)
We simulate 12 malicious payloads targeting the `/employees/{employeeId}` path that must be rejected:

1. **Unauthenticated Creation**: Create an employee without active authentication.
2. **Identity Spoofing (Owner ID Theft)**: Authenticated user A tries to create an employee with `ownerId` set to user B.
3. **Foreign Employee Reading**: Authenticated user A tries to read an employee owned by user B.
4. **Foreign Employee Updating**: Authenticated user A tries to update an employee owned by user B.
5. **Foreign Employee Deletion**: Authenticated user A tries to delete an employee owned by user B.
6. **Malicious ID Injection**: Creating an employee with a huge ID or non-alphanumeric characters.
7. **NIP Value Poisoning**: Injecting an invalid string type (e.g. non-numeric or too long) in `nip` field.
8. **Missing Mandatory Fields**: Attempting to create an employee record without `currentRank`, `birthDate`, or `children`.
9. **Bypassing Server Timestamps on Create**: Attempting to set `createdAt` manually to a past date.
10. **Bypassing Server Timestamps on Update**: Attemptimg to update `updatedAt` to a future date instead of `request.time`.
11. **Malicious Child Count Exhaustion**: Inserting an extremely large list of mock children to trigger Denial of Wallet.
12. **Tampering with Owner ID**: Trying to modify `ownerId` during an update operation to switch ownership.

## 3. Test Cases Draft Overview
- Verify permissions denied for any operations matching the above actions.
- Verify allow operations for clean Owner-matching transactions.
