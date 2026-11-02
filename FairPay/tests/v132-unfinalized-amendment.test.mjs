import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assessFinancialTerms, FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {createProject,stateOf,validateDraft} from '../project-model.mjs';

const cases=[
  ['A05', 'Project: Office poster campaign. Milestone 1: Poster design, USD 420 on approval. A later email says the parties may revise the amount, but no revised price is agreed or signed.'],
  ['pending one-amount modification', 'Project: Homepage audit. Milestone 1: Work is USD 490 on acceptance. A later memo proposes a change to the amount but no updated fee has been approved.'],
  ['unfinalized revised rate', 'Project: Data cleanup. Milestone 1: The fixed fee is USD 650. Parties may revise the fee, but no proposed amount has been agreed.'],
  ['revision price remains unconfirmed', 'Project: Poster layout. Milestone 1: Artwork USD 175. A tentative pricing change has been discussed and the revised fee remains unconfirmed.'],
];

test('v1.3.2 blocks one-amount unfinalized fee proposals even if model selects old fee',()=>{
 assert.equal(FINANCIAL_POLICY_VERSION,5);
 for(const [name,contract] of cases){
  const policy=assessFinancialTerms(contract,0,1);
  assert.equal(policy.status,'blocked',name+': '+JSON.stringify(policy));
  assert.ok(policy.riskCodes.includes('UNCONFIRMED_FINANCIAL_AMENDMENT'),name);
  const p=createProject({summary:name,currency:'USD',milestones:[{
   title:'Service',amount:'420.00',trigger:'approval',source_excerpt:'Milestone 1: Poster design, USD 420 on approval.',
   evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,
   financialRiskCodes:policy.riskCodes,financialRiskReasons:policy.reasons
  }]});
  p.milestones[0].approvalStatus='approved';
  assert.equal(stateOf(p.milestones[0]).code,'blocked',name);
  assert.throws(()=>validateDraft(p,0,'sb-buyer@personal.example.com',true),/blocked/i,name);
 }
});

test('v1.3.2 does not block creative revisions, resolved fees, or signed fee amendments',()=>{
 for(const contract of [
  'Project: Poster. Milestone 1: Poster design USD 300 after design revision approval.',
  'Project: UI icons. Milestone 1: Agreed fee USD 500. An unsigned note proposes different color variations; design changes are unconfirmed.',
  'Project: Logo. Milestone 1: Logo design USD 450. Changes to the fee were considered, but the parties confirmed the original fee of USD 450 remains in effect.',
  'Project: Banner. Milestone 1: Banner USD 500. Signed amendment revised the fee to USD 600, replacing USD 500.'
 ]){
  const policy=assessFinancialTerms(contract,0,1);
  assert.equal(policy.status,'clear',contract+': '+JSON.stringify(policy));
 }
});

test('v1.3.2 retains previously issued PayPal draft tracking but expires old policy attestations',()=>{
 const p=createProject({summary:'Existing invoice',currency:'USD',milestones:[{
  title:'Work',amount:'500.00',source_excerpt:'Work USD 500',trigger:'approved',evidence_matched:true,
  amount_verification:'verified',financialPolicyVersion:4,financialRiskCodes:[],financialRiskReasons:[]
 }]});
 p.milestones[0].approvalStatus='approved';
 assert.equal(stateOf(p.milestones[0]).code,'blocked');
 p.milestones[0].invoices.push({invoiceId:'INV2-SYNTHETIC-HISTORY',status:'DRAFT'});
 assert.equal(stateOf(p.milestones[0]).code,'draft');
});

test('v1.3.2 exact A05 benchmark must be blocked by deterministic policy',async()=>{
 const dataset=JSON.parse(await fs.readFile(new URL('../evaluation/cases.json',import.meta.url),'utf8'));
 const a05=dataset.cases.find(c=>c.id==='A05');
 assert.ok(a05);
 const policy=assessFinancialTerms(a05.agreement,0,1);
 assert.equal(policy.status,'blocked');
 assert.ok(policy.riskCodes.includes('UNCONFIRMED_FINANCIAL_AMENDMENT'));
});
