# A1 current-contract equivalence — mock only
All six new tests have10s Node deadlines; held mock events have3s bounds and release in finally. Original v186 tests unchanged, their4FAIL+1timeout remain historical evidence.

|Historical intent|New proof|
|---|---|
|Unverifiable PAID excludes revenue|A1-01 wrong/missing total and recipient → UNKNOWN,0paid KPI, existing ID retained, full refresh restores|
|Discrepancy audit and no duplicate|A1-01 reconciliation event/replay400, oneCREATE|
|Parallel refresh cannot overwrite newer response|A1-02 delayed DRAFT thenPAID, maximum1active read,3reads including initial, chronological history|
|Acceptance/amendment immutable after creation|A1-03 rejected after creation; ledger revision retained|
|In-flight authorization immutable|A1-03 heldCREATE rejects approval/amendment/ledger/duplicate, frozen authorized50000|
|Ambiguous create/UNKNOWN retry|A1-04 missingID uncertain,4retries no secondwrite;A1-05 ID+missingreadback UNKNOWN,refreshsameID|
|Refresh failure retains last-known evidence|A1-06 failedGET leaves invoice/timestamp unchanged and appends failureevent|

Executed6/6PASS. Evidence codex-work/sprint-a/A1/tests-01.log. Stale-response ordering is tested via serialized local mocks, not distributed provider timestamps/multi-process crashes. No production assurance or remote PayPal operation.
