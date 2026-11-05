> **Historical QA checkpoints.** This file preserves Sprint A and Sprint B engineering reports. The **current reader-facing interpretation** is in [Validation and Limitations](../docs/VALIDATION.md). The 155 passing checks below refer to a prior Sprint A scope; release documentation later reported 161 focused checks. Neither count means that the full historical suite passed. The final video contains a separately recorded Sandbox draft read-back, **not independently reproduced by the isolated QA environment**.

# Sprint A QA status — NON-RELEASE

Baseline dev8.6 focused146/146PASS. Sprint A adds9tests: A1six bounded mock equivalents, A2one deterministic workflow metric test, A4two health/report-label tests. Current source focused155/155PASS (109current+8scorer+27HTTP+11frozen). Final extracted-package evidence accompanies delivery.

Original historical failures remain visible: dev8.6 had197PASS/31FAIL+1unfinished timeout across46files. New tests supplement them, never rewrite answers. Final package full per-file run is reported separately; no all-green claim. Old v1.7 inventory also fails because evaluation runner/scorer changed in prior versions, now current runner labels corrected; never regenerate its gold/hash to conceal this.

A2 six frozen scenarios: deterministic and actual local qwen3:4b-instruct each2/2authorized positives,0/2false blocks,0/4unsafe allows,0errors. Credit/acceptance are synthetic in-memory review, not verified bank/client facts. Controlled scorer3fixtures separately:1/1positive,0falseblocks,0/2unsafe. No pooling or representative-accuracy claim.

A3 existing USD400 real Sandbox draft linkageINCOMPLETE/NOT RUN; no credentials or private data accessed. No live PayPal request. Native UI/user study remainNOT RUN this sprint; prior26headless checks are historical evidence, not rerun. Sprint B expressly deferred.

Use npm run qa:sprint-a; npm run verify:candidate inside extracted ZIP; npm run scan:release before creating local.env (or scanZIP). Historical verify:package remains a failing oldinventory check, not current package validation. Review docs/sprint-a and accompanying evidence.

## Sprint B bounded final pass

This release adds `tests/v1986-sprint-b-submission.test.mjs`, a presentation/non-write regression supplement. Current QA remains the same frozen gold with new isolated test cases. `npm run qa:sprint-b` is **focused**; historical failures are not suppressed. Chromium end-to-end browser attempt is **BLOCKED_BY_ADMINISTRATOR**, not PASS. Remote USD 400 Sandbox read-back remains INCOMPLETE. See `SPRINT_B_RELEASE_NOTES.md`.
