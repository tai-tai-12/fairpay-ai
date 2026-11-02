import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeUsd, validRecipient, evidenceMatches, safeInvoiceId, extractInvoiceId, verifyMilestoneAmount} from '../lib.mjs';
test('normalize USD without floating point conversion',()=>{
  assert.equal(normalizeUsd('500'),'500.00');
  assert.equal(normalizeUsd('0.01'),'0.01');
  assert.equal(normalizeUsd('800.5'),'800.50');
});
test('reject invalid money amounts',()=>{
  for (const input of ['0','-1','20.999','1e3','', '10 USD','100000000']) assert.throws(()=>normalizeUsd(input));
});
test('validate sandbox customer emails',()=>{
  assert.equal(validRecipient('buyer@example.com'),true);
  assert.equal(validRecipient('invalid-email'),false);
});
test('match literal source evidence',()=>{
  const source='1) Discovery — USD 500, due after client acceptance.';
  assert.equal(evidenceMatches(source,'Discovery — USD 500, due after client acceptance.'),true);
  assert.equal(evidenceMatches(source,'Client guarantees payment tonight.'),false);
});
test('invoice ID from PayPal body or links',()=>{
  assert.equal(safeInvoiceId('INV2-Z56S-5LLA-Q52L-CPZ5'),true);
  assert.equal(extractInvoiceId({links:[{href:'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-Z56S-5LLA-Q52L-CPZ5'}]}),'INV2-Z56S-5LLA-Q52L-CPZ5');
});

test('source cross-check corrects AI 80 to literal USD 800',()=>{
 const agreement='2) Final website handoff — USD 800, billable after the final files are delivered and accepted.';
 const excerpt='Final website handoff — USD 800, billable after the final files are delivered and accepted.';
 assert.deepEqual(verifyMilestoneAmount(agreement,excerpt,'80'),{
  amount:'800.00',status:'corrected',sourceAmount:'800.00',
  reason:'AI amount USD 80.00 did not match the literal source amount USD 800.00; corrected from the quoted agreement. Verify before drafting.'
 });
});
test('refuses ungrounded or ambiguous quoted amounts',()=>{
 const agreement='Terms: USD 500 or USD 800 depending on approval.';
 assert.equal(verifyMilestoneAmount(agreement,agreement,'500').amount,null);
 assert.equal(verifyMilestoneAmount(agreement,'Does not exist USD 500','500').status,'needs_review');
 assert.equal(verifyMilestoneAmount('We will decide the amount later.','We will decide the amount later.','123').amount,null);
});
test('matches a clear source amount even if model omitted it',()=>{
 const agreement='Service: USD 1,200.50 due upon acceptance';
 const check=verifyMilestoneAmount(agreement,agreement,null);
 assert.equal(check.amount,'1200.50');
 assert.equal(check.status,'corrected');
});
