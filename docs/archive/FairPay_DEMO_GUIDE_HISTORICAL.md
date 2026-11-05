# Synthetic demo — no PayPal writes
1. Launch fresh copy; Projects starts empty. Open Add agreement and select existing sample or paste: “Synthetic review sample. Milestone 1: Deliver one poster for USD 200 after actual client acceptance. No prior payments are asserted by this sample.”
2. Without Ollama, stop at source intake: this is NOT a complete offline extraction demo. With separately installed local model, analyze, inspect source quote and save with explicit evidence consent.
3. Billing: record synthetic financial review (all known payments/credits), then separately record acceptance for this fictional example. These are human records, not verified payments/identity.
4. Review exact net amount and recipient preview. STOP BEFORE CREATE. Do not enter credentials or invoke PayPal.
5. Offline illustrative outcome: “Synthetic illustration only — DRAFT · Not sent; no provider ID, no API call, no payment.” This sentence is a storyboard, never insert it into project invoice records.
For an executable isolated mock flow run `node --test tests/v1985-fault-boundaries.test.mjs`: concurrency, ambiguous write, recipient mismatch are tested against local stubs. Terminal test output is not real provider evidence.


## Sprint B reviewer-first demonstration (read-only)

From a brand-new clean install, open Overview → **Preview two safe billing decisions**. Example A shows fictional **USD 500 gross − USD 100 human-recorded deposit = USD 400 calculated outstanding**. Neither the credit nor acceptance is externally verified. Example B shows an **unsigned USD 600→700** fee change requiring verification. Use the two buttons to prefill the editable agreement; **prefill triggers no backend write and no AI analysis**. Review the real output only if Ollama is separately running. If the local model is absent, honestly show the setup notice and storyboard rather than claiming successful extraction. 

On the Billing workspace, distinguish **source fee**, **human-recorded ledger gross/credits/net**, **local policy eligibility**, and **existing PayPal read-back status**. DRAFT ≠ SENT ≠ PAID. Do not click Create Draft during the recorded safe demonstration; do not claim that the local storyboard is a provider integration test. Existing historical PayPal Sandbox data requires separate ID/recipient/authorization verification before presentation as real E2E evidence. See `docs/sprint-b/FINAL_SCOPE_AND_DEMO.md` for manual Mac checks. No synthetic credits or acceptance records are created by previewing examples.
