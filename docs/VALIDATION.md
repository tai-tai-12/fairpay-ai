# Validation and Limitations

This page clarifies the scope of evidence from different engineering checkpoints. It does not modify or replace the original QA records.

[Project overview](../README.md) · [Developer Guide](DEVELOPER_GUIDE.md)

## Evidence summary

| Evidence | What it supports | What it does not establish |
| --- | --- | --- |
| **161 focused checks** reported in release README | Focused candidate regression and fault testing at the release checkpoint | All historical tests passing or production compliance |
| **155 focused checks** in earlier Sprint A record | Earlier QA checkpoint | A contradictory final count; it predates the later release claim |
| **197 passing, 31 failing, 1 timeout** in historical suite | Transparent legacy test history | A fully green historical suite |
| Synthetic PayPal mocks | Provider error handling and guarded local logic | Real banking transactions, actual provider payment, or live end-to-end certification |
| V31 product demo | Recorded app behavior and a separate existing Sandbox DRAFT read-back | Independent remote verification by the earlier isolated QA environment |
| Static UI and isolated checks | Limited visual and structural checks | Complete native-browser, accessibility, or user-study verification |

**The documentation update itself does not rerun automated tests or perform a new live PayPal read-back.** The update script requires a local manifest check and attempts the focused suite before committing; its output on your machine is the relevant new evidence. Reproduce the focused results using the source code below.

## Three different demo scenarios

1. **Agreement discrepancy.** AI proposes **$50**; source says **$500**. A person reviews and corrects it.
2. **Blocked decision.** Another example requires additional review and does not proceed to invoice drafting.
3. **Separate Sandbox project.** An existing **$400 DRAFT** is shown in read-back, using an illustrative **$500 gross − $100 manually recorded credit**. The credit is not bank-verified; the invoice was not sent or paid.

These are **not one end-to-end paid transaction**.

## Provider verification boundary

A prior isolated QA run recorded its live remote check as **INCOMPLETE / NOT RUN**. That environment did not have access to the user's private merchant records or Sandbox invoice. The final video separately presents an existing Sandbox draft in the user's recorded local workflow. Do not convert the earlier unfinished QA into a completed independent validation claim.

Status **DRAFT** is not SENT or PAID. A malformed value or uncertain provider response should remain UNKNOWN, not be treated as proof of payment. No bank settlement was independently verified.

## Public evidence and reproducibility

The public repository contains source files, synthetic fixtures, focused test commands, and frozen adversarial inputs. It **does not include all historical, private engineering evidence bundles**. Some retained Sprint reports reference a separate `Evidence ZIP`, `codex-work/`, or `audit-work/` that was produced in an isolated development environment. Those referenced files are **not available in this public repository** and must not be presented as independently reproducible from this checkout.

For an inspectable starting point, run the focused test suite against the public source. The result you observe on your own system is stronger evidence than relying on a historical count. Do not regenerate expected outputs or alter historical gold files just to obtain a green run.

**Provider proof boundary:** The video records a read-back of a separate pre-existing Sandbox invoice; that footage is not a substitute for independent third-party verification. The earlier isolated QA did not complete remote linkage verification. Credits are user-recorded, not bank-confirmed.

## Reproduce focused checks

With Node.js 22+ and Python 3, from the `FairPay` directory:

```bash
npm run qa:sprint-b
npm run verify:candidate
npm run scan:release
```

The focused QA alias is defined in `package.json`. `verify:candidate` hashes released files against `CANDIDATE_MANIFEST.json`. The source scanner looks for obvious forbidden paths and secrets; it is not a forensic PII audit.

## Understanding source and manifest versions

- **Current build identity** remains `1.9.1-dev.8.6-sprint-b` in `FairPay/package.json` and `FairPay/VERSION.txt`.
- **V31** identifies the submitted video edit, not an app version.
- **`appVersion: 1.3.2`** is a legacy API compatibility field; `productVersion` identifies the current build.
- **`SOURCE_SHA256_MANIFEST.json`** is a historical source inventory. It must not be silently rewritten to represent the updated public README.
- **`CANDIDATE_MANIFEST.json`** is the current file-integrity inventory used by `verify:candidate`. The patch recomputes only entries for edited non-runtime documents and template comments.
- Version numbers in old test filenames and Sprint records are retained because they identify real engineering checkpoints, not UI copy.

## Remaining limitations

- Local, single-user, non-production prototype.
- No production authentication, verified buyer identity, or independent bank settlement.
- No secure public hosting or production-grade transactional guarantees.
- Local stored data is not encrypted using production key management.
- Real extraction requires separately installed Ollama and model. Outputs may vary.
- Native accessibility, user studies, and broad model accuracy claims remain unverified.
- No real customer, revenue, or payment-collection claims.

Original records remain available in [QA Status](../FairPay/QA_STATUS.md), [Known Limitations](../FairPay/KNOWN_LIMITATIONS.md), [Sprint A Remote Check](../FairPay/docs/sprint-a/A3_EXISTING_DRAFT_READ_ONLY.md), and [Sprint B Scope](../FairPay/docs/sprint-b/FINAL_SCOPE_AND_DEMO.md).
