# Explore FairPay AI

FairPay AI helps users review agreements and understand why an amount may or may not be ready for invoicing. It is a **local prototype**, not a live payment service.

[Watch the 3-minute demo](https://www.youtube.com/watch?v=pivk3KyXpEQ) · [Project overview](../README.md) · [Installation and testing](DEVELOPER_GUIDE.md)

## Find your way around the app

The application has **three main navigation pages**. Use the same names in the left sidebar.

| App navigation | What you can do |
| --- | --- |
| **Overview** | Explore saved projects and preview two fictional billing decisions |
| **Agreements** | Load agreement text, run optional local AI analysis, and review source evidence |
| **Payments** | Review recorded credits, calculated balances, approvals, and PayPal Sandbox invoice states |

**Review gates** and **PayPal Sandbox read-back** are capabilities within the workflow, not separate navigation pages. A new installation starts with an empty project list.

## Try the fictional examples

1. Start the app with the [Quick Start](../README.md#quick-start). A fresh install starts with **zero projects**.
2. Open **Overview → Preview two safe billing decisions**.
3. The clear-fee example illustrates a **$500 agreement**. A separate **$100 human-recorded credit** would make a calculated **$400 balance**. The preview itself does **not** create a credit or verify a deposit.
4. The conflict example contains an original **$600** term and an unsigned **$700** proposal. The unsigned change should not silently become billable.
5. In **Agreements**, you may inspect source text. Actual AI extraction requires a running local Ollama model, followed by explicit source review.

These preview actions do **not** call PayPal, analyze with AI, create a project, record a payment, or authorize an invoice. For a step-by-step workflow, use the [Demo Guide](../FairPay/DEMO_GUIDE.md).

## What to expect on a fresh install

| What you have installed | What you will see |
| --- | --- |
| Node.js only | Real running interface and prefilled synthetic text; no AI request or PayPal activity from preview buttons |
| Node.js and Ollama with the correct model running | You can click **Analyze** in Agreements and review actual proposed terms and excerpts |
| Optional own Sandbox credentials | An environment for deliberate testing with your own synthetic project, not the video's existing draft |

The video presents three separate demonstrations. You should **not** expect a fresh installation to contain the historical $400 invoice or the recorded synthetic financial ledger.

## Quick walkthrough

1. Start the local server with Node.js 22+ and open `http://127.0.0.1:3000`.
2. On **Overview**, open **Preview two safe billing decisions**. The clear-fee example shows $500 gross, $100 illustrative credit, and $400 calculated net. It does not record a payment.
3. Choose **Try clear-fee sample** to prefill editable text in **Agreements**. The text is not a model result.
4. If Ollama and `qwen3:4b-instruct` are running, click **Analyze**, then compare proposals against their source excerpts.
5. Inspect **Payments** only after creating a new synthetic project and completing required human review. Never use a real contract or send an invoice.

**Expected limitation:** the recorded $400 PayPal Sandbox DRAFT is in a different historical sample project and is **not present** on a fresh installation. This is intentional, not a missing demo asset.

## What the financial statuses mean

- **Agreement amount** refers to source-supported contract terms.
- **AI suggestion** is a candidate value that can be wrong.
- **Recorded credit** is a human entry, not bank verification.
- **Outstanding balance** is a calculation, not permission to invoice.
- **DRAFT** means an invoice has not been sent.
- **UNKNOWN** means the provider state is uncertain and must not be assumed paid.

## What the demo shows and what it does not verify

The video shows a **$50 vs. $500** correction, a **separate blocked-review** example, and a **different sample project** with an existing **$400 PayPal Sandbox DRAFT**. That draft is **not sent or paid**. The $100 credit is human-recorded, not independently verified.

A new clone does **not** contain the private historical Sandbox invoice or merchant credentials. The demo does not prove real customer adoption, bank settlement, production authentication, or a fully deployed payment service.

## Safety

Use synthetic data only. Do not enter real client agreements or personal financial information. Do not expose the local server to the internet.

To install or test the source, see [Installation and testing](DEVELOPER_GUIDE.md). To examine test coverage and evidence boundaries, see [Validation and limitations](VALIDATION.md).
