import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assessFinancialTerms, FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {assessAmendment} from '../lib.mjs';
import {createProject,stateOf,validateDraft} from '../project-model.mjs';
import {scoreCase,summarizeResults} from '../evaluation/scorer.mjs';

const blockedSamples=[
  ['HA02','Project: Coral packaging. Milestone 1: Packaging mockups at USD 600. A proposed unsigned memo suggests USD 700 but parties have not confirmed the revised fee.'],
  ['unsigned change order','Project: App marketing. Milestone 1: Banner USD 500. An unsigned change order suggests a new fee USD 550, awaiting signature.'],
  ['tentative modification','Project: Site audit. Milestone 1: Fixed fee USD 250. A tentative modification proposes fee USD 300, not yet agreed.'],
  ['draft but not approved','Project: Drafting. Milestone 1: Artwork USD 430. A draft amendment proposes increasing the price to USD 480 but the change has not been approved.'],
  ['not executed','Project: Campaign. Milestone 1: USD 700 upon sign-off. Proposed memo lists another payment amount USD 750 and the memo remains unexecuted.']
];

test('v1.3.1 blocks HA02 and differently worded unconfirmed financial amendments',()=>{
  assert.equal(FINANCIAL_POLICY_VERSION,5);
  for(const [name,contract] of blockedSamples){
    const p=assessFinancialTerms(contract,0,1);
    assert.equal(p.status,'blocked',name+': '+JSON.stringify(p));
    assert.ok(p.riskCodes.includes('UNCONFIRMED_FINANCIAL_AMENDMENT'),name);
    const project=createProject({summary:name,currency:'USD',milestones:[{
      title:'Milestone 1',amount:'600.00',trigger:'client acceptance',source_excerpt:'Milestone 1',
      evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,
      financialRiskCodes:p.riskCodes,financialRiskReasons:p.reasons
    }]});
    project.milestones[0].approvalStatus='approved';
    assert.equal(stateOf(project.milestones[0]).code,'blocked',name);
    assert.throws(()=>validateDraft(project,0,'sb-buyer@personal.example.com',true),/blocked/i,name);
  }
});

test('v1.3.1 does not confuse creative revision approval with financial revision',()=>{
  for(const contract of [
    'Project: Pitch deck. Milestone 1: Draft narrative — USD 1,200 after revision approval. Milestone 2: Final slides — USD 2,350 after final sign-off.',
    'Project: Poster. Milestone 1: Poster design USD 300 after color revision approval.',
    'Project: App. Milestone 1: Icon delivery costs USD 650. An unsigned memo proposes different icon colors; the design changes have not been confirmed.'
  ]){
    const count=(contract.match(/Milestone\s+\d+:/g)||[]).length;
    for(let i=0;i<count;i++){
      const p=assessFinancialTerms(contract,i,count);
      assert.equal(p.status,'clear',JSON.stringify(p));
    }
  }
});

test('v1.3.1 retains confirmed changes through existing amendment review',()=>{
  for(const contract of [
    'Project: Brand. Milestone 1: Design fee USD 500. Contract amendment: the fee was revised to USD 550 and supersedes the original USD 500.',
    'Project: Web. Milestone 1: Fixed fee USD 500. The parties signed a contract amendment: the fee was changed to USD 650; the prior fee is superseded.'
  ]){
    const policy=assessFinancialTerms(contract,0,1);
    assert.equal(policy.status,'clear',JSON.stringify(policy));
    const a=assessAmendment(contract,0,1);
    assert.ok(a,'existing amendment logic must independently flag review');
    assert.equal(a.status,'amendment_review');
  }
});

test('v1.3.1 new policy expires old un-attested project draft authorization but keeps historical invoices',()=>{
  const p=createProject({summary:'Legacy',currency:'USD',milestones:[{
    title:'Work',amount:'600.00',trigger:'approval',source_excerpt:'Milestone 1: Work USD 600',
    evidence_matched:true,amount_verification:'verified',financialPolicyVersion:3,financialRiskCodes:[],financialRiskReasons:[]
  }]});
  p.milestones[0].approvalStatus='approved';
  assert.equal(stateOf(p.milestones[0]).code,'blocked');
  assert.throws(()=>validateDraft(p,0,'sb-buyer@personal.example.com',true),/blocked/i);
  p.milestones[0].invoices.push({invoiceId:'INV2-EXAMPLE-12345678',status:'DRAFT'});
  assert.equal(stateOf(p.milestones[0]).code,'draft');
  assert.equal(p.milestones[0].invoices[0].invoiceId,'INV2-EXAMPLE-12345678');
});

test('v1.3.1 updated scorer prevents false payment readiness for HA02 despite valid old excerpt',async()=>{
  const cases=JSON.parse(await fs.readFile(new URL('../evaluation/holdout.json',import.meta.url),'utf8'));
  const c=cases.cases.find(c=>c.id==='HA02');
  assert.ok(c);
  const risk=assessFinancialTerms(c.agreement,0,1);
  const response={currency_code:'USD',milestones:[{
    title:'Packaging mockups',amount:null,trigger:'approval',
    source_excerpt:'Milestone 1: Packaging mockups at USD 600.',evidence_matched:true,
    amount_verification:'needs_review',financialPolicyVersion:FINANCIAL_POLICY_VERSION,
    financialRiskCodes:risk.riskCodes,financialRiskReasons:risk.reasons
  }]};
  const score=scoreCase(c,response,10);
  assert.equal(score.allAmountsCorrect,true);
  assert.equal(score.allSafetyCorrect,true);
  assert.equal(score.rows[0].predictedGate,'blocked');
  assert.equal(summarizeResults([score]).unsafeDraftsAllowed,0);
});

test('v1.3.1 scopes proposed fee amendments to the affected numbered milestone',()=>{
  const contract='Project: Two-stage website. Milestone 1: Discovery USD 500, billable on approval. Milestone 2: Handoff USD 800, billable on acceptance. A proposed unsigned change order suggests USD 900 for the handoff, but the revised fee is not confirmed.';
  const first=assessFinancialTerms(contract,0,2);
  const second=assessFinancialTerms(contract,1,2);
  assert.equal(first.status,'clear');
  assert.equal(second.status,'blocked');
  assert.ok(second.riskCodes.includes('UNCONFIRMED_FINANCIAL_AMENDMENT'));
});
