import test from 'node:test';
import assert from 'node:assert/strict';
import {getBillingJourney} from '../public/billing-journey.mjs';
const base=()=>({canonicalId:'m-1',amount:500,evidence_matched:true,approvalStatus:'pending',invoices:[],readiness:{code:'pending'}});
const ledger=()=>({receivable:{status:'HUMAN_RECORDED',milestones:[{milestoneId:'m-1',grossMinor:50000,creditedMinor:10000,outstandingMinor:40000}]}});
test('unverified source calls for agreement evidence',()=>{
 const m=base();m.evidence_matched=false;assert.equal(getBillingJourney({},m).next,'source');
});
test('source verified but no financial ledger requires review',()=>{
 assert.equal(getBillingJourney({},base()).next,'ledger');
});
test('ledger never silently constitutes client acceptance',()=>{
 const j=getBillingJourney(ledger(),base());assert.equal(j.next,'acceptance');assert.equal(j.amountMinor,40000);assert.equal(j.accepted,false);
});
test('eligible milestone without invoice offers draft review',()=>{
 const m=base();m.approvalStatus='approved';const j=getBillingJourney(ledger(),m);assert.equal(j.next,'draft');assert.equal(j.draft,false);
});
test('existing draft takes priority and never offers new creation',()=>{
 const m=base();m.approvalStatus='approved';m.invoices=[{status:'DRAFT',invoiceId:'INV2-QA',total:{value:'400.00',currency:'USD'}}];
 const j=getBillingJourney(ledger(),m);assert.equal(j.next,'draft-review');assert.equal(j.draft,true);assert.equal(j.invoice.invoiceId,'INV2-QA');
});
test('unknown external status prompts reconciliation',()=>{
 const m=base();m.invoices=[{status:'UNKNOWN'}];assert.equal(getBillingJourney(ledger(),m).next,'status-review');
});
test('existing draft not hidden if ledger is stale or missing',()=>{
 const m=base();m.evidence_matched=false;m.invoices=[{status:'DRAFT'}];assert.equal(getBillingJourney({},m).next,'draft-review');
});

test('unconfirmed controlling amendment sends user back to evidence',()=>{
 const m=base();m.amount_verification='amendment_review';m.amendmentConfirmed=false;assert.equal(getBillingJourney(ledger(),m).next,'source');
});
