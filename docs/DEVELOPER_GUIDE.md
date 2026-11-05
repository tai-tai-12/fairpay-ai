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

## First-run verification

After `npm start`, open **http://127.0.0.1:3000**. The navigation shows **Overview**, **Agreements**, and **Payments**.

1. On **Overview**, select **Preview two safe billing decisions**. The sample cards appear without creating a project.
2. Click **Try clear-fee sample**. It fills editable fictional agreement text. This is not a model result or a saved credit.
3. With Ollama running, go to **Agreements** and click **Analyze** to see candidate terms and source passages. Check them before saving.
4. Use **Payments** to inspect review requirements only after you deliberately create a synthetic project. Do not use real customers or money.

A fresh clone contains **no private project data**, no historical authorization, and no access to the $400 Sandbox draft shown in the V31 video.

## Document import portability

- **Paste text, TXT, and MD** are the most portable inputs.
- **DOCX** text extraction uses the system `unzip` command and works only when that utility is installed.
- **Selectable-text PDF import currently requires macOS**, because the implementation uses macOS PDFKit through `osascript`.
- Scanned image PDFs are **not** supported; there is no OCR. Paste relevant text instead.
- The import limit is **2 MB per file** and up to **12,000 extracted characters**. Use fictional agreement content.

These are current implementation constraints from `FairPay/document-import.mjs`, not planned features.

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

## Version identifiers and historic scripts

- Application build is `1.9.1-dev.8.6-sprint-b` in `package.json` and `VERSION.txt`.
- The public demo video's **V31** label is a video editing version, not the application build.
- `appVersion: 1.3.2` in `/api/health` is a legacy compatibility field. Use `productVersion` for the candidate identifier.
- A `v0.4` comment in `.env.example` and historical `qa:dev*` scripts were retained intentionally. Do not replace version identifiers in test fixtures or manifests merely to make their labels look new.
- Use **`npm run qa:sprint-b`** for the documented focused check. Running **`npm test`** triggers the historical suite, which includes documented failing cases.

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
