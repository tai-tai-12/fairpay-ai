# User Guide

**For freelancers, hackathon judges, and first-time reviewers.**

FairPay AI helps users review agreements and understand why an amount may or may not be ready for invoicing. It is a **local prototype**, not a live payment service.

[Watch the 3-minute demo](https://www.youtube.com/watch?v=pivk3KyXpEQ) · [Project overview](../README.md)

## What each workspace does

| Workspace | Purpose |
| --- | --- |
| Overview | Explore a project and preview safe fictional billing situations |
| Agreement | Examine agreement text, candidate AI terms, and source evidence |
| Billing | Keep contract gross, human-recorded credits, and net balance separate |
| Review controls | Show why evidence or approval requirements can block invoice drafting |
| PayPal Sandbox | Work with deliberately authorized drafts and read back provider status when configured |

## Try the fictional examples

1. Start the app with the [Quick Start](../README.md#quick-start). A fresh install starts with **zero projects**.
2. Open **Overview → Preview two safe billing decisions**.
3. The clear-fee example illustrates a **$500 agreement**. A separate **$100 human-recorded credit** would make a calculated **$400 balance**. The preview itself does **not** create a credit or verify a deposit.
4. The conflict example contains an original **$600** term and an unsigned **$700** proposal. The unsigned change should not silently become billable.
5. In **Agreement**, you may inspect source text. Actual AI extraction requires a running local Ollama model, followed by explicit source review.

These preview actions do **not** call PayPal, analyze with AI, create a project, record a payment, or authorize an invoice. For a step-by-step workflow, use the [Demo Guide](../FairPay/DEMO_GUIDE.md).

## What the financial statuses mean

- **Agreement amount** refers to source-supported contract terms.
- **AI suggestion** is a candidate value that can be wrong.
- **Recorded credit** is a human entry, not bank verification.
- **Outstanding balance** is a calculation, not permission to invoice.
- **DRAFT** means an invoice has not been sent.
- **UNKNOWN** means the provider state is uncertain and must not be assumed paid.

## What the submitted video proves and does not prove

The video shows a **$50 vs. $500** correction, a **separate blocked-review** example, and a **different sample project** with an existing **$400 PayPal Sandbox DRAFT**. That draft is **not sent or paid**. The $100 credit is human-recorded, not independently verified.

A new clone does **not** contain the private historical Sandbox invoice or merchant credentials. The demo does not prove real customer adoption, bank settlement, production authentication, or a fully deployed payment service.

## Safety

Use synthetic data only. Do not enter real client agreements or personal financial information. Do not expose the local server to the internet.

Developers should continue with the [Developer Guide](DEVELOPER_GUIDE.md). Reviewers can inspect [Validation & Limitations](VALIDATION.md).
