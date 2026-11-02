# Sprint B — final bounded submission experience (NON-RELEASE)

The final UX polish consists of **read-only** demo choice, credit/net explanation, AI-availability disclosure, and dark/mobile styling. No AI/provider API, ledger, policy or authorization logic was changed.

## Synthetic story 1: clear fee and human-recorded credit

Open a **fresh, empty** FairPay copy in Overview. Expand “Preview two safe billing decisions”. See the purely illustrative arithmetic **USD 500 contract gross − USD 100 human-recorded deposit = USD 400 calculated outstanding**. This is **not a verified payment**, client acceptance, an invoice authorization or a PayPal draft.

Choose “Try clear-fee sample”; the app only fills an editable synthetic agreement (fixed **USD 500** fee; the text expressly does **not** verify any deposit). If local Ollama is configured, you **may** click Analyze and independently inspect the returned model evidence. Saving a project, recording a separate fictional USD 100 credit, attesting acceptance and authorizing a draft are **distinct steps**; do not record these attestations without deliberately adopting their synthetic assumptions. **Stop before Create Draft**. A local illustration of DRAFT is not external PayPal evidence.

## Synthetic story 2: unsigned amendment

On the same fresh Overview expand the read-only examples, choose “Try conflict sample”. The textarea now has **original USD 600, proposed unsigned USD 700**. Observe whether your actual local AI analysis detects the conflict; if the model does not, report that fact. The system should not be advertised as resolving unsigned terms or collecting an invoice automatically. No agreement is auto-saved.

## Required manual Mac browser checks (NOT performed in isolated CI)

- Desktop **1440px**, phone-equivalent **390px**: Light and Dark Mode; expanded examples fit viewport, no sideways scrollbar; text and buttons legible.
- Keyboard-only: focus both sample buttons and edit textarea; check visible focus and tab order.
- Click clear then conflict then clear: textarea and character count update; check **no new saved project, no provider invoice and no local credit/acceptance record**.
- Without Ollama: model-unavailable message must not suggest analysis succeeded. With Ollama: synthetic case results are model observations, not guarantees.
- Existing-invoice screen: confirm human-recorded balance vs *last-stored* PayPal read-back, and Draft ≠ Sent ≠ Paid.

## Stop conditions

Sprint B is the **only** final feature/UX iteration. After sign-off, create final README/GitHub/demo/video and address only confirmed P0/P1 submission blockers. Preserve Sprint A candidate and checkpoints. Remote existing USD 400 draft linkage is **UNVERIFIED** in this environment. Do not create a replacement invoice.
