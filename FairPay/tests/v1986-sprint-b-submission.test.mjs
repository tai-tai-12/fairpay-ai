import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getBillingJourney} from '../public/billing-journey.mjs';
import {invoiceReviewPreview} from '../public/trust-guide.mjs';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=text('public/index.html'),js=text('public/app.js'),css=text('public/style.css');

test('Two distinct synthetic demos remain illustrative, with no stored PayPal state',()=>{
  for(const marker of ['id="welcomeClear"','id="welcomeConflict"','id="sampleClear"','id="sample"','EXAMPLE A · HUMAN-RECORDED CREDIT','EXAMPLE B · CONFLICTING TERMS','Fictional storyboard only'])assert.ok(html.includes(marker),marker);
  assert.match(html,/USD 500\.00[\s\S]*USD 100\.00[\s\S]*USD 400\.00/);
  assert.match(html,/not a verified payment or billing authorization/);
  assert.match(html,/Neither example creates a saved project, provider invoice, or PayPal status/);
});
test('Synthetic sample buttons only load text and do not call analysis or bill',()=>{
  assert.match(js,/function loadExample\(text,kind\)\{setSourceMethod\('paste'\)/);
  assert.match(js,/\$\('agreement'\)\.dispatchEvent\(new Event\('input'/);
  assert.match(js,/\$\('sampleClear'\)\.onclick=\(\)=>loadExample\(CLEAR_EXAMPLE_AGREEMENT/);
  const f=js.match(/function loadExample\(text,kind\)[\s\S]*?\n}/)?.[0]||'';
  assert.ok(f.includes("$('agreement').value=text"));
  assert.doesNotMatch(f,/(?:\bapi\(|\bfetch\(|\/api\/projects|\/api\/invoices)/);
});
test('Billing presentation uses current recorded ledger gross, not source-only fee as payable amount',()=>{
 const source={canonicalId:'M1',amount:500,evidence_matched:true,approvalStatus:'pending',invoices:[]};
 const project={currency:'USD',agreementVersionId:'v1',receivable:{status:'HUMAN_RECORDED',milestones:[{milestoneId:'M1',grossMinor:50000,creditedMinor:10000,outstandingMinor:40000}]}};
 const j=getBillingJourney(project,source);
 assert.equal(j.amountMinor,40000);assert.equal(j.creditedMinor,10000);assert.equal(j.next,'acceptance');
 const preview=invoiceReviewPreview(project,source);
 assert.equal(preview.amount,'USD 400.00');assert.equal(preview.credits,'USD 100.00');assert.equal(preview.existing,false);
 assert.match(js,/Contract gross · local ledger/);assert.match(js,/Net outstanding · local estimate/);
 assert.match(js,/Saved draft total|Existing invoice total · last stored/);
 assert.match(js,/DRAFT · NOT SENT/);assert.match(js,/No PayPal invoice created/);
});
test('No-AI state discloses extraction dependency; mobile and dark styles are explicit',()=>{
 assert.match(js,/Local Ollama is not ready/);
 assert.match(js,/Nothing is analyzed or billed by loading a sample/);
 assert.match(css,/\.demo-scenarios\{display:grid/);
 assert.match(css,/@media\(max-width:700px\)\{\.demo-scenarios\{grid-template-columns:1fr/);
 assert.match(css,/:root\[data-theme="dark"\] \.journey-trust-track\.external/);
 assert.match(css,/:root\[data-theme="dark"\] \.ai-provider-notice/);
 assert.match(css,/:focus-visible/);
});
