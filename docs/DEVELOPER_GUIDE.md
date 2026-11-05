# Developer Guide

**For developers and technical reviewers.**

[Project overview](../README.md) · [User Guide](USER_GUIDE.md) · [Validation & Limitations](VALIDATION.md)

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | **22 or newer** |
| npm packages | No third-party runtime packages required |
| Python 3 | Optional for integrity and source-scanning tools |
| Ollama and `qwen3:4b-instruct` | Required for actual local AI extraction |
| PayPal developer Sandbox | Optional for deliberate API testing with your own credentials |
| Network hosting | Local loopback only, `127.0.0.1` |

## Install and run

```bash
git clone https://github.com/tai-tai-12/fairpay-ai.git
cd fairpay-ai/FairPay
node --version
npm run setup
npm start
```

Open **http://127.0.0.1:3000**. `npm run setup` copies `.env.example` to a local `.env` only when `.env` does not already exist. Keep this file untracked. The new installation starts with no projects or historical invoice IDs. Stop the server with Ctrl+C.

## Enable local AI

1. Install and run [Ollama](https://ollama.com/download).
2. Run `ollama pull qwen3:4b-instruct`.
3. Open the Agreement page, load synthetic source text, click Analyze, and review the model's candidate terms against the source.

The default `.env.example` selects Ollama. Without a running model, a preview is not real extraction. Model outputs can vary.

## Optional PayPal Sandbox configuration

Create **your own** Sandbox app via [PayPal Developer](https://developer.paypal.com/). In your private `FairPay/.env` configure:

```dotenv
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
```

Do **not** use live credentials or publish `.env`. The public package does not contain the private historical Sandbox draft, ledger, or authorization. The safe demo guide deliberately stops **before Create Draft**. Do not create a replacement invoice to imitate the video. The local service is not suitable for real payment processing.

## Main code areas

| Path | Responsibility |
| --- | --- |
| `FairPay/public/` | Browser UI and CSS |
| `FairPay/server.mjs` | Local server and HTTP API |
| `FairPay/agreement-evidence.mjs` | Agreement source and evidence |
| `FairPay/contract-invariants.mjs` | Contract constraints |
| `FairPay/financial-policy.mjs` | Financial decision gates |
| `FairPay/receivables.mjs` | Gross, recorded credits, and calculated net |
| `FairPay/paypal-adapter.mjs` | Sandbox provider interactions and conservative status handling |
| `FairPay/project-store.mjs` | Local project storage |
| `FairPay/tests/` | Automated test coverage |
| `FairPay/evaluation/` | Synthetic evaluation scenarios |
| `FairPay/audit/` | Frozen adversarial checks |
| `FairPay/tools/` | Setup, source scan, and integrity checks |

See [Architecture](../FairPay/ARCHITECTURE.md) and [Security & Privacy](../FairPay/SECURITY_AND_PRIVACY.md).

## Run focused checks

From the `FairPay` directory:

```bash
npm run qa:sprint-b
npm run verify:candidate
npm run scan:release
```

The earlier release reported **161 passing focused checks**, but this is **not** an all-green full historical suite. Some legacy tests still have documented failures. Provider fault tests use synthetic mocks. This documentation-only change has **not rerun** the checks. See [Validation & Limitations](VALIDATION.md).

**Integrity note.** `FairPay/CANDIDATE_MANIFEST.json` stores hashes for released candidate files. Do not edit or move files inside `FairPay/` without intentionally revalidating the package. This documentation update preserves those files exactly.

## Operating boundaries

Single user. Synthetic records. Local unencrypted persistence. No production-grade authentication, independent bank reconciliation, verified buyer identity, public deployment safety, or guaranteed provider transaction recovery. DRAFT is not PAID; ambiguous states must fail closed.
