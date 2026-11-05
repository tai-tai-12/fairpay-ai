# FairPay AI — 2:45 English Video Plan (record actual screen footage)

**Must be on YouTube, publicly visible, under 3:00.** Official requirements call for functioning app footage, not a static mockup. Keep the movie free of private API keys and unlicensed music. Recording may use edited cuts, but do not misrepresent UI states or imply that a synthetic mock is live PayPal.

| Time | Screen to record | English voice-over draft |
|---|---|---|
| 0:00–0:20 | FairPay Overview, product UI | “A contract fee is not always the amount someone should invoice. Deposits, acceptance, and changing terms make freelancer payments surprisingly easy to get wrong.” |
| 0:20–0:55 | Overview sample, Agreements source evidence | “FairPay AI uses a local language model to propose milestones and show the agreement passages behind each amount. AI suggestions are evidence for human review, not permission to charge.” |
| 0:55–1:35 | Agreements policy & financial review, Payments financial workflow | “Here the contract is five hundred dollars. We record a one-hundred-dollar credit separately, so the outstanding balance is four hundred dollars. That credit is a synthetic human record, not bank-verified payment.” |
| 1:35–2:15 | Payments existing invoice ID, verified refresh activity | “With explicit controls, FairPay creates and reconciles PayPal Sandbox invoice drafts. This existing four-hundred-dollar draft was read back successfully on November first. Its status is DRAFT: it was not sent and it was not paid.” |
| 2:15–2:45 | Decision guide, no duplicate draft, optional amendment view | “FairPay refuses to equate unknown provider status with payment, and blocks duplicate draft creation. The aim is not autonomous billing at any cost; it is a transparent agreement-to-invoice workflow people can trust.” |

## Pre-recording checks

- Confirm the app is the patched Final Audit version; keep server bound to localhost.
- Confirm real local Ollama response before recording any footage labeled AI extraction. If it fails, do not fake an extraction; record a truthful feature walk-through and clearly distinguish illustrative examples.
- Capture a fresh **read-only** PayPal Sandbox refresh for the **existing** draft if relevant. Never press Send, Pay, Create Draft, Cancel or Delete.
- Use only the fictional project `QA_SANDBOX_001_LANDING_PAGE`, with synthetic terms and credit, and ensure no `.env` / credentials / other projects appear on screen.
- Distinguish local financial review, PayPal invoice *read-back*, and bank settlement.
- Show enough moving UI interactions for the judge to see a working app, not a slide deck.
- Add the public GitHub URL and YouTube URL to Devpost when available.
