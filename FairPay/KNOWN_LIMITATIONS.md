# FairPay AI · Known limitations

**Prototype status:** local, single-user, synthetic-data only. PayPal **Sandbox**, not live payment processing. The application is not production-ready.

## Product limitations

- No production-grade identity or access control, verified buyer identity, independent bank settlement verification, or safe hosted deployment.
- Project and agreement records are persisted locally without production encryption. Do not use real client documents or personal payment data.
- Local AI extraction requires a separately running Ollama model. Model results can vary, and proposals require source checking.
- The UI can prefill synthetic example text without AI. That prefill is **not** a successful AI extraction.
- Recorded client acceptance and credits are user attestations, not external confirmation of buyer approval or a bank-verified payment.
- A PayPal Sandbox invoice **DRAFT** is unsent and unpaid. Ambiguous or malformed provider results should not be accepted as proof of payment.
- Native accessibility, real user studies, and broad model-accuracy benchmarking are not validated for this submission.

## Reproducibility boundaries

- The public source contains no historic local project records, private PayPal invoice reference, merchant credentials or historical authorization state.
- The V31 video shows a separate existing $400 Sandbox DRAFT. Earlier isolated QA could not independently perform a remote read-back of that private record.
- Synthetic provider mocks test selected fail-closed behavior, not external financial settlement.
- Some historical isolated QA reports reference external Evidence ZIPs and logs not published in this repository.
- The historical full-suite results include failures and timeouts; focused regressions are a separate scope. See [Validation and Limitations](../docs/VALIDATION.md).

The application has code for explicitly authorized **Sandbox** draft creation and read-back, but the earlier isolated engineering audit did **not** authorize or perform external Sandbox writes. That audit restriction should not be confused with a claim that the product cannot support deliberate Sandbox testing.
