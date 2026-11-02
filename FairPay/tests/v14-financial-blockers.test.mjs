// Release-blocking regressions discovered by LIVE v1.4 stress QA.
// Frozen stress scenarios and gold labels are read unchanged. These tests are
// preserve the failed-gate expectations after the financial policy repair.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessFinancialTerms} from '../financial-policy.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('../evaluation/stress-v13.json',import.meta.url),'utf8')).cases;
for(const id of ['S13-M02','S13-C01','S13-C02']){
 test(`RELEASE BLOCKER ${id}: unsafe pricing must fail closed independently of model extraction`,()=>{
  const scenario=cases.find(c=>c.id===id);
  assert.equal(scenario.expected.milestones[0].gate,'blocked','frozen gold requires review');
  const policy=assessFinancialTerms(scenario.agreement,0,1);
  assert.equal(policy.status,'blocked',`${scenario.scenario}: current policy incorrectly returns clear`);
 });
}

import {createProject,stateOf,validateDraft} from '../project-model.mjs';
import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
test('safety repair invalidates old saved eligibility without erasing invoice references',()=>{
 const p=createProject({currency:'USD',milestones:[{title:'Accepted layout',amount:'100.00',source_excerpt:'Layout USD 100',evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});
 p.milestones[0].approvalStatus='approved';assert.equal(stateOf(p.milestones[0]).code,'ready');
 delete p.milestones[0].financialPolicyRevision;
 assert.throws(()=>validateDraft(p,0,'synthetic@example.test',true),/policy review/i);
 p.milestones[0].invoices.push({invoiceId:'INV2-SYNTHETIC-HISTORY',status:'DRAFT'});
 assert.equal(stateOf(p.milestones[0]).code,'draft');assert.equal(p.milestones[0].invoices[0].invoiceId,'INV2-SYNTHETIC-HISTORY');
});
