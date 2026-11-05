# FairPay AI — Final layout QA (submission-only CSS patch)

Scope: CSS-only fix. The PayPal read-back, financial ledger, acceptance, application JS, API server, and test cases were not changed. The pre-existing Audit P0-001 security fix remains intact.

## Confirmed issue and patch

- Overview's **Show archived projects** checkbox is displaced because a global `button,select,input{min-height:44px}` style overrides the checkbox's desired 20px height. The label aligns items at `flex-start` and the checkbox retains browser-default margins.
- Fix checkbox `min-height:20px` and `margin:0`; center-align the Overview archive filter.
- At 390px mobile width, the project row was visibly crowded and **Needs review** wrapped awkwardly. Use a two-by-two filter grid and stack project name and amount in the project row at widths <=480px.
- Long underscore-separated project IDs still use the previously tested `overflow-wrap:anywhere` rule in the inspector.

## Checks performed

- Examined original Overview user screenshot and previous Agreement / Payments exports.
- Inspected full current CSS/HTML and existing structural selectors.
- Ran Chromium **isolated static DOM** geometry/screenshot checks using actual stylesheet on **390, 650, 768, 900, 1100, 1440 px** in both **light and dark** for Overview, Agreements, Payments (36 combinations). No horizontal viewport overflow detected in the representative content.
- The `Show archived projects` checkbox measured **20px high** and vertically centered after patch, rather than the inherited **44px** pre-patch box.
- Browser navigation to localhost is blocked by this audit environment (ERR_BLOCKED_BY_ADMINISTRATOR); screenshots here are **static representative DOM checks**, not a live end-to-end browser test or evidence of actual PayPal state.
- The user's real Mac database, provider state and credentials are not present in this ZIP and were not accessed.

## Release boundaries

- Changed in app: `FairPay/public/style.css` plus its digest in `FairPay/CANDIDATE_MANIFEST.json` **only**. `SOURCE_SHA256_MANIFEST.json` is historical provenance and remains unchanged.
- Retains NON-RELEASE / SANDBOX ONLY. Not production ready.
- Run `python3 tools/verify-clean.py`, `npm run qa:sprint-b` after applying to your local data-backed app.
- Never upload `.env`, `.local-data`, PayPal Sandbox secrets, local backup folders.
