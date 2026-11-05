# FairPay AI

**Evidence-led billing for freelancers and small service teams.**

FairPay AI helps users review agreement terms, check billing amounts against the source, and work with PayPal Sandbox invoice drafts under explicit human approval. The AI proposes information. It does **not** authorize billing or verify payments.

**[Watch the 3-minute demo](https://www.youtube.com/watch?v=pivk3KyXpEQ)** · **[User Guide](docs/USER_GUIDE.md)** · **[Developer Guide](docs/DEVELOPER_GUIDE.md)** · **[Validation & Limitations](docs/VALIDATION.md)**

> **Hackathon prototype only.** Local single-user application, synthetic examples, PayPal Sandbox only. **Not production-ready.** Do not use real client data, funds, or live credentials.

## Product overview

1. **AI-assisted agreement analysis.** Local Ollama with `qwen3:4b-instruct` proposes milestones, fees, deliverables, and source excerpts. Users check the source before accepting suggestions.
2. **Source verification.** An incorrect $50 suggestion is corrected against an agreement that states $500.
3. **Financial review.** Contract fees, manually recorded credits, and outstanding balances remain separate. $500 less a user-recorded $100 credit produces a **calculated $400 balance**. This credit is **not bank verified**.
4. **Human safety gates.** Missing evidence, incomplete review, unresolved acceptance, or an amount mismatch can block invoice drafting.
5. **PayPal Sandbox.** Explicitly authorized draft handling and read-back. The final video separately shows an **existing $400 Sandbox DRAFT**, **not sent or paid**.

These are **separate demonstration scenarios**, not a single completed or bank-verified payment. A fresh clone has **zero saved projects** and no access to the historical private Sandbox invoice.

## Start here

| Goal | Read |
| --- | --- |
| See the finished product demonstration | [Final demo video](https://www.youtube.com/watch?v=pivk3KyXpEQ) |
| Understand the UI and explore fictional examples | [User Guide](docs/USER_GUIDE.md) |
| Install, configure AI, and inspect code | [Developer Guide](docs/DEVELOPER_GUIDE.md) |
| Follow a safe synthetic walkthrough | [Demo Guide](FairPay/DEMO_GUIDE.md) |
| Evaluate test evidence and known limitations | [Validation & Limitations](docs/VALIDATION.md) |
| Find more technical and historical documents | [Documentation Index](docs/README.md) |

## Quick start

Requires **Node.js 22+**. The Node application uses built-in modules and does not require installing npm dependencies.

```bash
git clone https://github.com/tai-tai-12/fairpay-ai.git
cd fairpay-ai/FairPay
npm run setup
npm start
```

Open **http://127.0.0.1:3000**. Choose **Overview → Preview two safe billing decisions**. The previews fill fictional source text only. They do not run AI analysis, save a project, contact PayPal, or record payment.

For actual AI extraction, install and run [Ollama](https://ollama.com/download) locally, then run:

```bash
ollama pull qwen3:4b-instruct
```

Without the running model, extraction is unavailable. PayPal API testing is optional and requires your **own Sandbox** credentials. See the [Developer Guide](docs/DEVELOPER_GUIDE.md).

## Architecture at a glance

```text
Agreement text or document
     ↓
Local AI proposes candidate terms and source excerpts
     ↓
Source verification + deterministic financial rules
     ↓
Human review, acceptance, and authorization
     ↓
PayPal Sandbox invoice DRAFT and read-back
```

- `FairPay/public/` contains the browser interface.
- `FairPay/server.mjs` serves the local app and API routes.
- `FairPay/agreement-evidence.mjs`, `financial-policy.mjs`, and `receivables.mjs` handle the evidence and financial model.
- `FairPay/paypal-adapter.mjs` handles provider integration.
- `FairPay/tests/`, `evaluation/`, `audit/`, and `tools/` contain regression checks, synthetic evaluation cases, audit checks, and setup utilities.

## Evidence and limitations

The release README previously reported **161 passing checks in the focused QA suite**. That is **not** a claim that all historical tests pass. Historical failures, incomplete browser checks, and provider-evidence boundaries remain documented. The documentation cleanup **does not rerun tests**.

The video depicts a separate existing Sandbox DRAFT read-back. Earlier isolated engineering QA **did not independently access the private Sandbox invoice**, so its remote verification result remains recorded as **incomplete**. The synthetic credit is not a bank-confirmed deposit. See [Validation & Limitations](docs/VALIDATION.md) and [Security & Privacy](FairPay/SECURITY_AND_PRIVACY.md).

The service binds to `127.0.0.1` and persists local records. It lacks production authentication, buyer identity verification, independent bank settlement verification, and secure hosted deployment. Never expose the app to the public internet.

## License

[MIT License](LICENSE). Copyright © 2026 FairPay AI Project Contributors.
