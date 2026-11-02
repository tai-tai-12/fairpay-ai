# A2 positive/negative gate analysis
Six new criteria frozen in evaluation/sprint-a-workflows.json + SHA before first response. Original benchmark labels untouched.

Deterministic synthetic extraction + current authorization functions:6/6 completed; expected-ready2, authorized-positive2, false-block0/2, expected-blocked4, unsafe-allow0/4, errors0. $500/no-credit and $500 gross minus human-recorded$100credit = exact$400 authorize only after simulated complete accounting/acceptance/exact-net review. Unknown credit(no complete ledger), unresolved amendment, missing acceptance and wrong gross authorization block.

Actual local qwen3:4b-instruct run of the SAME6cases also completed6/6: positives2/2, false-block0/2, unsafe-allow0/4, errors0. Evidence codex-work/sprint-a/A2/live-01.json includes raw synthetic analysis, per-case state, reasons, latency and health. No PayPal or projects API called; review and acceptance are in-memory simulation, not authenticated clients or verified debt. Negative unknown-credit case intentionally has no completed ledger: its blocking does NOT prove the model independently understood the credit.

Controlled scorer separately uses3static response fixtures against frozen N02/M01/A01: expected-ready1, authorized-positive1, false-block0/1, unsafe0/2 unsafe-test denominator. This checks scorer/gate semantics, not live model accuracy. Do not pool denominators across methods.

Historical PDF ready→blocked observation is known only from supplied review/roadmap; the PDF itself is not supplied here. No claim to reproduce its six original cases. Diagnose readiness by source verification/current revision → complete ledger/allocations → current acceptance → exact amount and revision → provider state. Missing prerequisites are deliberate blocks; a fully prepared positive that remains blocked is a candidate false block. No policy tuned after outputs, and no general accuracy guarantee from two positives.

Reproduce deterministic: node tools/sprint-a-evaluate.mjs NEW_REPORT.json
Live synthetic-only: launch this extracted app from a new folder with empty credentials using `env -i PATH="$PATH" HOST=127.0.0.1 PORT=38186 AI_PROVIDER=ollama node server.mjs`; then `node tools/sprint-a-evaluate.mjs NEW_REPORT.json http://127.0.0.1:38186`. Requires separately installed local Ollama/qwen3:4b-instruct. Never point at personal app data or provide PayPal keys. No provider write endpoint is used. Reports exclusive-create; no overwrite. Native full user workflow not established by this test.
