# FairPay Sprint B — single bounded final UX iteration

**Version:** `1.9.1-dev.8.6-sprint-b` · **NON-RELEASE / SANDBOX ONLY**

- Only changed the **presentation layer** (first-run examples, AI-unavailable text, billing labels, dark/mobile contrast), version metadata, QA tests and documentation.
- New read-only example math: fictional USD 500 gross less USD 100 recorded deposit = USD 400 calculated outstanding; **NOT verified deposit, approval, authorized draft or provider state**.
- Clear-fee and unsigned-amendment sample buttons fill editable textarea only. No auto-analyze or auto-save.
- Billing amounts now show source-only fees separately from human-recorded reconciled amounts and last-stored provider amount.
- Security/policy/provider/ledger/server implementations are unchanged from Sprint A by file hash (see Review Evidence).
- Regression: current focused QA to be independently run; old test failures not reclassified to PASS. Native Chromium attempt was blocked by administrator policy and cannot be counted as UI PASS.
- **STOP:** no further Sprint C. Next steps are Mac manual visual smoke, optional existing-invoice read-only verification, and hackathon submission assets.
