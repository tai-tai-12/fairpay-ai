# FairPay AI · Security and privacy

**NON-RELEASE / SANDBOX ONLY.** Runs on the local loopback interface. Do not expose this service to the public internet or use it with live payments or real client records.

## Data handling

- Saved projects, agreement versions and ledger records are held locally, without production-grade encryption.
- Use **synthetic** agreements, identities, credits and approvals. Do not store bank details, customer contracts or sensitive personal records in this prototype.
- The `.env` file is local and excluded from Git. Never commit PayPal client credentials, authorization tokens or private Sandbox invoice IDs.
- Default AI extraction uses local Ollama. If a cloud AI provider is configured separately, submitted agreement text may leave the local machine; treat this as a distinct privacy decision.

## Financial safety boundary

- An AI-proposed term is not an authorized invoice. Source excerpts, financial reconciliation and explicit human decisions are separate inputs.
- A contract gross amount is different from outstanding receivables and the exact authorized draft amount.
- A human-recorded credit is **not** bank-confirmed receipt, and a recorded acceptance is **not** verified buyer identity.
- DRAFT is not SENT or PAID. UNKNOWN and malformed provider read-backs must not be treated as proof of payment.
- The application includes checks for version, amount, currency, local reviews and duplicate/uncertain operations, but does not provide production-grade distributed transactions or independent settlement verification.

## Testing and audit scope

Automated provider tests use loopback mocks and fictional data. An earlier isolated security review prohibited external PayPal writes, while the product contains an explicitly authorized **Sandbox-only** draft workflow for deliberate testing. Those are different scopes. The V31 demo's existing private Sandbox draft cannot be independently reproduced from a fresh public clone.

A source scan checks certain obvious secret patterns and forbidden paths, not forensic privacy or security compliance. See [Validation and Limitations](../docs/VALIDATION.md) for test-scope and evidence gaps.
