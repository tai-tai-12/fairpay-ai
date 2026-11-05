# FairPay AI · Architecture

**Scope:** single-user Node.js application running at `127.0.0.1`. Local JSON persistence and PayPal Sandbox only. Not a production payment system.

## Processing flow

```text
Agreement text / supported document
                |
                v
Local Ollama + Qwen3:4b-instruct proposes terms and source excerpts
                |
                v
Source verification + deterministic contract and financial rules
                |
                v
Human-recorded financial review and actual acceptance attestation
                |
                v
Exact amount, currency, revision and authorization checks
                |
                v
Explicit PayPal Sandbox DRAFT operation, then provider read-back
                |
                v
Stored history and conservative reconciliation status
```

AI outputs are **untrusted candidate terms**. Financial authorization is controlled by deterministic application rules and deliberate human actions. DRAFT is not SENT or PAID; human-entered credits are not bank-confirmed receipts.

## Key implementation boundaries

| Module | Purpose |
| --- | --- |
| `server.mjs` | Local HTTP server, JSON API, analysis sessions, integration orchestration |
| `public/` | Browser Overview, Agreements and Payments UI |
| `agreement-evidence.mjs` | Agreement source evidence and version references |
| `contract-invariants.mjs` | Agreement and billing invariants |
| `financial-policy.mjs` | Deterministic financial eligibility and conservative blockers |
| `receivables.mjs` | Gross, recorded credits and calculated outstanding amounts |
| `project-model.mjs`, `project-store.mjs` | Project state and local persisted records |
| `paypal-adapter.mjs`, `payment-integrity.mjs` | Sandbox provider interaction, status checking and reconciliation |
| `tests/`, `evaluation/`, `audit/` | Regressions, synthetic evaluation and adversarial checks |

## Setup and portability

The application uses Node.js 22+ and built-in Node modules. AI extraction requires a separately running Ollama instance and model. The default model is `qwen3:4b-instruct`. Browser access is local. PayPal Sandbox testing requires separately provisioned credentials and deliberate authorization.

Text paste is the most portable agreement input. DOCX import uses the host `unzip` tool; text-based PDF import requires macOS PDFKit. Scanned PDFs are not OCR-processed. See [Developer Guide](../docs/DEVELOPER_GUIDE.md) for exact limits and setup steps.

## Security and evidence

Local storage is not production encrypted. The app does not independently verify buyer identity, credit settlement, or real bank payments. Mock provider tests cannot prove external payment state. The final demonstration includes a separately maintained historical Sandbox draft unavailable in a fresh checkout. See [Validation](../docs/VALIDATION.md) and [Security and Privacy](SECURITY_AND_PRIVACY.md).
