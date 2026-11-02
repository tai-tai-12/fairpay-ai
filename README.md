# FairPay AI

**Evidence-led agreement-to-invoice workflow for freelancers and small service teams.**

FairPay AI turns messy agreement language into **reviewable milestone evidence**, separates contract fees from human-recorded payments/credits, and conservatively manages a **PayPal Sandbox invoice draft**. The AI extracts *candidate* terms; deterministic policy and explicit human review decide whether an invoice draft may be authorized. An invoice draft is **not** an invoice sent or a payment received.

> **Hackathon prototype only — Sandbox / local single-user mode. Not production-ready.** Do not use for real funds, private client agreements, or unattended financial actions.

## What it demonstrates

1. **Evidence-led extraction:** local Ollama (`qwen3:4b-instruct`) proposes milestones, deliverables, fees, and relevant agreement excerpts; humans review evidence and save explicitly.
2. **Financial reconciliation:** the ledger keeps contract gross, manually entered credits, and net outstanding separate. **USD 500 gross − USD 100 user-recorded credit = USD 400 outstanding** is a synthetic example, not bank-confirmed payment.
3. **Human decision gates:** independent source, financial review, acceptance, exact amount, and currency checks must be satisfied before a draft can be considered.
4. **PayPal Sandbox:** draft creation is an explicitly authorized Sandbox action, with invoice ID/read-back reconciliation, duplicate-write blocking, and conservative `UNKNOWN` treatment for ambiguous or malformed provider responses. **No automatic sending or collecting payments.**
5. **Auditability:** saved agreement versions, ledger revisions, and PayPal read-backs provide a readable trail of the decisions taken.

## Quick start — any fresh machine (no existing FairPay folders required)

Requirements: **Node.js 22+**; **Python 3** optional for integrity checks; local **Ollama** and model for real AI extraction. Node application uses built-in Node modules and requires no third-party npm packages.

```bash
cd FairPay
node --version
python3 tools/verify-clean.py      # optional code-integrity check
npm run setup                       # creates a local .env from .env.example
npm start
```

Open **http://127.0.0.1:3000**. A fresh install deliberately starts with **zero saved projects**. Go to **Overview → Preview two safe billing decisions** to explore the two illustrative, read-only samples. Preview buttons only populate sample text and do not create a project, recognize a payment, or contact PayPal.

**To run AI analysis (not just preview the UI):** install [Ollama](https://ollama.com/download) and start it locally; fetch the application model:

```bash
ollama pull qwen3:4b-instruct
```

The local Ollama app/service must be running. In **Agreements**, load the clear-fee sample, press Analyze, inspect the model's *candidate* results and source evidence, and save only after explicit review. Results can vary. Without Ollama, source extraction is **unavailable**; merely loading an example is not a successful AI demonstration.

## PayPal Sandbox testing (optional)

Create your **own** free Sandbox developer account and app at [PayPal Developer](https://developer.paypal.com/). On **your own machine**, enter its Sandbox credentials in the untracked `FairPay/.env` copied by `npm run setup`:

```env
PAYPAL_CLIENT_ID=your_own_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_own_sandbox_client_secret
```

Do **not** enter live credentials or publish your `.env`. The demo workflow uses explicit approvals; never create a new invoice just to inspect an already saved one. A new installation has no access to our pre-existing private Sandbox invoice ID or local historical ledger. Follow the steps in `FairPay/DEMO_GUIDE.md` for a safe synthetic walkthrough and use the app's Sandbox-only controls only when deliberately testing with your own synthetic data.

## Tests and integrity

```bash
cd FairPay
npm run qa:sprint-b
python3 tools/verify-clean.py
python3 tools/scan-clean.py
```

Current focused suite: **161 passing checks** (115 current regression + 8 scorer + 27 isolated HTTP baseline + 11 frozen adversarial), on the supplied clean candidate. A separate adversarial audit found and patched a malformed PayPal `due_amount` parsing bug (would otherwise have allowed a false `PAID` classification); malformed provider amounts now fail closed as `UNKNOWN`. **These automated checks use synthetic mocks**, and do not certify the full historical suite or production compliance. `FairPay/QA_STATUS.md` and `FairPay/KNOWN_LIMITATIONS.md` document those boundaries.

## System design

```text
Agreement text / DOCX / PDF
          |
          v
Local Ollama → untrusted candidate terms + source excerpts
          |
          v
Source/provenance check → deterministic policy → human review
          |
          v
Human-recorded ledger and acceptance → exact net authorization
          |
          v
PayPal Sandbox invoice DRAFT → read-back / reconciliation / audit
```

The **AI does not authorize payments**. This app runs at `127.0.0.1` and persists synthetic records locally; it has no buyer identity verification, bank settlement verification, production-grade authentication, or distributed transactional guarantee.

## For judges

- Start here, then see `FairPay/DEMO_GUIDE.md`, `FairPay/ARCHITECTURE.md`, and `FairPay/KNOWN_LIMITATIONS.md`.
- This repository contains **all application source code**, test fixtures, example configuration and the MIT license. The Ollama model itself is **not bundled** (download separately).
- A hosted public demo is **not provided**. The runnable local build above is the functional demo pathway.
- The submission video shows a separately maintained **synthetic project** and a verified **PayPal Sandbox DRAFT read-back**. The user-recorded credit is *not* independently verified; no payment was received.
- All demo assets and examples must be synthetic; no API keys or client data are published.

## Security, license and status

The app is intentionally **NON-RELEASE / SANDBOX ONLY**. Do not expose this loopback development service to the public internet. See `FairPay/SECURITY_AND_PRIVACY.md`. MIT License (`LICENSE`).
