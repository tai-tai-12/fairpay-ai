import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paymentView} from '../public/payment-view.mjs';
import {readOnlyDecisionGuide} from '../public/trust-guide.mjs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('TRUST85-12 ready-to-draft is NOT styled as a green PAID terminal state',()=>{
 const v=paymentView({readiness:{code:'ready',next:'Review'},approvalStatus:'approved',amount:'500.00',evidence_matched:true,invoices:[]});
 assert.equal(v.tone,'info');assert.equal(v.invoiceLabel,'No PayPal invoice');assert.equal(v.canCreateDraft,true);
});
test('TRUST85-13 existing unsent DRAFT explicitly differs from paid and does not allow another create',()=>{
 const v=paymentView({readiness:{code:'draft',next:'Review existing'},amount:'500.00',invoices:[{status:'DRAFT',invoiceId:'INV2-QA-12345678',lastVerifiedAt:'2026-10-16T00:00:00Z'}]});
 assert.match(v.invoiceLabel,/not sent/i);assert.equal(v.canCreateDraft,false);assert.equal(v.group,'invoiced');
});
test('TRUST85-14 read-only guide never converts human ledger into provider settlement',()=>{
 const j=readOnlyDecisionGuide({currency:'USD',receivable:{status:'UNVERIFIED'}},{amount:'500.00',evidence_matched:true,source_excerpt:'Milestone 1: fee USD 500.',readiness:{code:'blocked'},invoices:[]});
 assert.match(j.questions[0].answer,/not proof of outstanding debt/);assert.match(j.questions[1].answer,/No current, completed financial ledger/);
});
test('TRUST85-15 UI names both trust domains and responsive cards without adding payment actions',()=>{
 assert.match(app,/Billing eligibility · local review/);assert.match(app,/PayPal invoice · Sandbox read-back/);assert.match(app,/No bank settlement implied/);
 assert.match(css,/\.journey-trust-tracks/);assert.match(css,/@media\(max-width:760px\)/);
});
