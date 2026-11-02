# Submission checklist — PayPal AI Hackathon 2026

**Official deadline:** Thursday 2026-11-12, **12:00 noon Pacific Standard Time / 3:00 p.m. Eastern Standard Time**. Aim to submit by Nov 10. Official rules: https://paypalaihackathon.devpost.com/rules

## Before public GitHub upload

- [ ] Run `cd FairPay && python3 tools/verify-clean.py && python3 tools/scan-clean.py && npm run qa:sprint-b`.
- [ ] Only publish **this clean package**. Do NOT publish Mac `FairPay_Final_With_Data`, `FairPay_Private_Backup_*`, old dev folders, `.env`, `.local-data`, token captures, or a ZIP containing those files.
- [ ] Double-check repository files in browser before enabling public access.
- [ ] Create a GitHub repository; upload the **contents of this directory** (root README + LICENSE + FairPay/). Do not upload the outer ZIP alone.
- [ ] Confirm MIT license detected at repository root; README is English and displayed at root.
- [ ] Test fresh clone and Node 22+ startup. Local preview works without Ollama; actual AI extraction requires model setup.
- [ ] Ensure judges can run without access to your personal Sandbox and that the optional bring-your-own-Sandbox setup is explained.

## Video and Devpost

- [ ] Record truthful screen walkthrough under 3:00, with functional app footage.
- [ ] Verify the local AI extraction on screen before calling it live AI behavior; don't substitute example prefill.
- [ ] Upload a public YouTube video and check opening link from a signed-out browser.
- [ ] Fill Devpost English project text, technologies, public code URL, demo instructions, YouTube URL, team details.
- [ ] Do not submit a private GitHub repository or a static mockup instead of a runnable demo.
- [ ] Confirm Devpost shows a successful submission before the deadline. Maintain judge access through Dec 15, 2026.

## Disclosures

- [ ] Sandbox-only, NON-RELEASE; not production ready.
- [ ] USD 100 credit is synthetic and user-recorded, **not** bank verified.
- [ ] Existing USD 400 invoice is **DRAFT, NOT SENT, NOT PAID** (latest read-back in your screenshots Nov 1 2026 10:57:21 PM).
- [ ] Focused current QA 161/161; historical 31 FAIL and one timeout were **not repaired or silently represented as passing**.
- [ ] No general AI accuracy claims based on 6 observed local evaluation cases.
- [ ] The original app's unencrypted local persistence and missing production-grade identity/auth controls remain limitations.
