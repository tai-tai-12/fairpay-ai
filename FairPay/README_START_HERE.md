# FairPay AI · Local build guide

This is the runnable **local Sandbox prototype**, not a production payment app. For a quick introduction, begin with the [root README](../README.md), then choose the [User Guide](../docs/USER_GUIDE.md) or [Developer Guide](../docs/DEVELOPER_GUIDE.md).

## First run

Install **Node.js 22+** and run these commands from this `FairPay/` folder.

```bash
npm run setup
npm start
```

Open **http://127.0.0.1:3000**. Fresh installations start with **zero projects**. On **Overview**, select **Preview two safe billing decisions**. These controls only populate synthetic examples. They do not run the model, save projects, authorize billing, create drafts, or confirm a credit.

## Optional AI and Sandbox setup

- For real AI extraction, install and start local Ollama and pull the model with `ollama pull qwen3:4b-instruct`.
- To test PayPal integration, provide **your own PayPal Sandbox** credentials in the untracked `.env`, only for deliberate actions on new fictional data.
- Never enter real client agreements or live credentials. Do not use this app for real payments or public hosting.
- No historical invoice ID, local ledger, or PayPal account data is bundled. A fresh installation cannot reproduce the video's private $400 Sandbox draft read-back.

## Check the source

```bash
npm run qa:sprint-b
npm run verify:candidate
npm run scan:release
```

These commands check a **focused** regression suite, file hashes, and obvious accidental-secret patterns. They do not certify production readiness or prove remote bank settlement. `npm test` invokes an older broader suite with documented failures. See [Validation](../docs/VALIDATION.md) and [QA history](QA_STATUS.md).

**Build identifiers:** the current internal application identifier is `1.9.1-dev.8.6-sprint-b`, while the submitted video is V31. The API `appVersion` field is a separate legacy compatibility marker; do not rewrite it for presentation purposes.

The former multi-Sprint Chinese handoff text is archived under [Historical documents](../docs/archive/README.md) and is not the current run instruction.
