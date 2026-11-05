# FairPay AI · Safe local demo

Follow these steps to explore fictional billing scenarios in a fresh local installation. Do not use real contracts, live PayPal credentials, or real funds.

## Explore sample cases without AI or PayPal

1. Install Node.js 22+ and run `npm run setup` then `npm start` from `FairPay/`.
2. Open `http://127.0.0.1:3000`. Starting with **zero saved projects** is expected.
3. In **Overview**, expand **Preview two safe billing decisions**.
4. **Clear-fee sample** illustrates a $500 fee, a $100 human-recorded *illustrative* credit, and a calculated $400 outstanding balance. The credit is not independently verified, and previewing it does not store a ledger entry.
5. **Conflict sample** illustrates original $600 terms and an unsigned $700 change. The unsigned proposal is not automatically approved.
6. Select **Try clear-fee sample** or **Try conflict sample** to fill editable synthetic agreement text. **Preview and prefill do not call AI, save a project, or contact PayPal.**

## Run optional local AI analysis

1. Install and start Ollama; run `ollama pull qwen3:4b-instruct`.
2. In **Agreements**, load the fictional sample and click **Analyze**.
3. Compare the model's candidate amount and quoted source excerpt with the actual text. Do not treat a proposal as verified authority. Model outcomes can vary.
4. Save only with explicit source review. If continuing to a synthetic billing review, create only fictional project, credit, and acceptance records. **Stop before Create Draft** in the recommended safe walkthrough.

## PayPal example in the final video

The submitted V31 video includes a **different, existing PayPal Sandbox project** with a $400 DRAFT read-back. It is not a continuation of the blocked-review sample. The $100 credit was entered by a person and is not bank-verified. The invoice was not sent or paid. **The private historical invoice ID, merchant credentials, and local ledger are intentionally excluded from this public checkout.**

The product includes deliberately authorized Sandbox draft handling, but no provider API calls are required to follow these safe examples. For optional provider setup with **your own** test merchant, consult [Developer Guide](../docs/DEVELOPER_GUIDE.md); do not recreate the original invoice for demonstration.

## What these steps do not establish

Sample preview is not model extraction. Local synthetic records are not confirmed buyer acceptance or bank settlement. Automated provider mocks do not certify an end-to-end real payment. The public code is not production-ready. See [Validation and Limitations](../docs/VALIDATION.md).
