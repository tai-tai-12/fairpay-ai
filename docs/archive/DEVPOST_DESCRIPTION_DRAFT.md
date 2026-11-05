# FairPay AI — Devpost English Submission Draft

**Tagline:** From agreement evidence to safer, reviewable PayPal invoices.

## Inspiration
Freelancers and small service teams often manage scope, acceptance, prior credits, and invoices across messages and documents. A fee mentioned in a contract is not necessarily the amount that should be invoiced today. An AI that simply extracts a number and automatically bills it can make an expensive mistake.

## What it does
FairPay AI helps a freelancer review an agreement, identify candidate milestones and fee evidence, record any prior credits separately, and determine the exact outstanding amount before an explicitly authorized PayPal Sandbox draft. It tracks the draft's last verified PayPal state and keeps DRAFT, SENT, and PAID distinct. It never automatically sends a bill or claims that human-recorded credits are bank-verified.

The synthetic demonstration uses a USD 500 fixed fee and a manually recorded USD 100 credit. FairPay computes an outstanding balance of USD 400, associates it with one existing USD 400 Sandbox draft, and verifies that draft remains unsent. A second illustrative scenario shows an unsigned fee change that must not silently become a new billable amount.

## How we built it
The browser UI runs on a Node.js 22+ loopback server. Local Ollama with `qwen3:4b-instruct` proposes contract terms and points back to source excerpts. Server-side deterministic rules enforce evidence completeness, fee precedence, ledger revision, exact minor-unit arithmetic, explicit human acceptance and authorization, and conservative idempotent PayPal Sandbox invoice state handling. Saved source versions, financial review records, and provider read-backs form an inspectable local audit trail.

## Challenges we ran into
The hardest challenge was preventing plausible-looking AI output from becoming financial authority. Credits can be manually recorded but not independently bank-verified, contract amendments may conflict, and an external API request can time out after creating an invoice. We designed fail-closed states and duplicate-creation locks. Adversarial testing exposed a malformed PayPal `due_amount` read-back that could incorrectly imply `PAID`; it was repaired to preserve `UNKNOWN` pending reconciliation.

## Accomplishments
A cohesive agreement-to-invoice prototype with explicit human control, a verified synthetic PayPal Sandbox draft read-back, a USD 500/100/400 gross-credit-net explanation, and a current focused QA suite of 161 passing checks. A final adversarial audit added 10 targeted tests in a separate evidence harness. The application can run locally without proprietary AI API keys.

## What we learned
In payments, uncertainty is a first-class product state. Financial correctness depends on separating extracted source terms, user attestations, authorization, provider status, and actual settlement rather than treating them as interchangeable signals.

## What's next
Future work includes authenticated multi-user access, externally verified buyer acceptance and bank settlement, more robust document ingestion, accessibility/usability validation, stronger cross-process transactional guarantees, and broader measured model accuracy. This submission is strictly a single-user Sandbox prototype; those features are not claimed as shipped.

## Technologies
JavaScript / Node.js, browser HTML/CSS, local Ollama, Qwen3 4B Instruct, PayPal Invoicing Sandbox API, deterministic financial controls, local JSON persistence, Node test runner, Python integrity tooling.

## Judge access
The public repository includes the complete source, English setup and test instructions, and a MIT license. Install Node.js 22+, optionally install Ollama and pull `qwen3:4b-instruct`, run `npm run setup && npm start` inside `FairPay`, and open `http://127.0.0.1:3000`. To test PayPal API interactions, bring your own PayPal Sandbox credentials; no real credentials or private invoices are bundled.

**Important:** Replace claims about the demo video and add the actual GitHub and YouTube URLs **only after those actions are complete**. Do not claim the user-recorded USD 100 credit is verified or the USD 400 draft has been paid.
