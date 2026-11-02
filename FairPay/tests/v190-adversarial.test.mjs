/** Independent v1.9.0 security/product fixes against a frozen adversarial matrix.
 * Synthetic agreements and loopback PayPal/Ollama mocks only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {reconcileSyntheticGross,grossAuthorization} from './support/receivable-fixture.mjs';
import {assessFinancialTerms} from '../financial-policy.mjs';
import {createPaypalAdapter} from '../paypal-adapter.mjs';
import {reconcileInvoice} from '../payment-integrity.mjs';
import {createProject,stateOf} from '../project-model.mjs';
import {FINANCIAL_POLICY_REVISION} from '../financial-policy.mjs';
const id='INV2-AUDIT-12345678';
const amount='500.00';
const basicText='Project: Neptune audit. Milestone 1: Accepted audit fee USD 500, payable after actual client acceptance.';
const model=(contract)=>({project_summary:'Synthetic audit',currency_code:'USD',warnings:[],milestones:[{title:'Audit deliverable',amount:contract.match(/USD (\d+)/)?.[1]||'500',trigger:'acceptance',source_excerpt:contract.split('. ').find(s=>s.includes('Milestone 1:'))?.trim().replace(/\.$/,'')||contract}]});
const auth={milestoneIndex:0,recipientEmail:'customer@example.test',confirmed:true};
const invoiceHandler=(overrides={},counter={writes:0})=>(req,res,json)=>{
 if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
 if(req.method==='POST'){counter.writes++;return json(res,{id},201);}
 return json(res,{id,status:'DRAFT',amount:{currency_code:'USD',value:overrides.amount||amount},primary_recipients:[{billing_info:{email_address:overrides.recipient||auth.recipientEmail}}]});
};
test('source-matched gross fee never overrides previous paid deposit',async()=>{
 const source='Project: Neptune audit. Milestone 1: The final report fee is USD 1000 upon client acceptance. The customer already paid a USD 300 deposit toward this milestone. Only USD 700 remains outstanding.';
 const h=await harness(model);try{
  const a=await h.request('/api/analyze',{contractText:source});assert.equal(a.status,200);
  assert.equal(a.body.milestones[0].amount,null);
  assert.ok(a.body.milestones[0].financialRiskCodes.includes('PRIOR_PAYMENT_RECONCILIATION_REQUIRED'));
  const save=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Neptune',persistEvidence:true});assert.equal(save.status,201);
  const p=save.body.project;await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved'});
  const fresh=(await h.request(`/api/projects/${p.id}`)).body.project;assert.equal(fresh.milestones[0].readiness.code,'blocked');
  assert.equal((await h.request(`/api/projects/${p.id}/drafts`,{...auth,agreementVersionId:p.agreementVersionId})).status,400);assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});
test('conflicting same deliverable fees are not source-verified permission to draft',()=>{
 const contract='Milestone 1: The design fee is USD 500. A later signed email says USD 700 for the same deliverable. Both terms remain active pending a decision on which fee governs.';
 assert.equal(assessFinancialTerms(contract).status,'blocked');
});
test('mock PayPal recipient mismatch is marked UNKNOWN and requires reconciliation, not success',async()=>{
 let writes=0;
 const h=await harness(model,(req,res,json)=>{
  if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
  if(req.method==='POST'){writes++;return json(res,{id},201);}
  return json(res,{id,status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:'wrong@example.test'}}]});
 });try{
  const a=await h.request('/api/analyze',{contractText:basicText});assert.equal(a.status,200);
  const p=(await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Neptune',persistEvidence:true})).body.project;
  const revision=await reconcileSyntheticGross(h,p);
  assert.equal((await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved',agreementVersionId:p.agreementVersionId})).status,200);
  const d=await h.request(`/api/projects/${p.id}/drafts`,{...auth,...grossAuthorization(p,revision)});
  assert.equal(d.status,201);assert.equal(d.body.status,'UNKNOWN');assert.equal(d.body.project.milestones[0].readiness.code,'reconcile');assert.equal(writes,1);
  assert.equal((await h.request(`/api/projects/${p.id}/drafts`,{...auth,...grossAuthorization(p,revision)})).status,400);assert.equal(writes,1);
 }finally{await h.close();}
});
test('mock PayPal wrong amount creates one reference and forces reconciliation',async()=>{
 const h=await harness(model,invoiceHandler({amount:'999.00'}));try{
  const a=await h.request('/api/analyze',{contractText:basicText});const p=(await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Neptune',persistEvidence:true})).body.project;
  const revision=await reconcileSyntheticGross(h,p);
  await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved',agreementVersionId:p.agreementVersionId});
  const r=await h.request(`/api/projects/${p.id}/drafts`,{...auth,...grossAuthorization(p,revision)});
  assert.equal(r.status,201);assert.equal(r.body.status,'UNKNOWN');assert.equal(r.body.project.milestones[0].readiness.code,'reconcile');
 }finally{await h.close();}
});
test('missing numbered milestones cannot be silently dropped',async()=>{
 const text='Project: Two items. Milestone 1: Report USD 500 after acceptance. Milestone 2: Workshop USD 400 after acceptance.';
 const h=await harness(()=>({...model(text),milestones:[{title:'Report',amount:'500',source_excerpt:'Milestone 1: Report USD 500 after acceptance',trigger:'accepted'}]}));try{
  const r=await h.request('/api/analyze',{contractText:text});assert.equal(r.status,422);assert.match(r.body.error,/omitted/);
 }finally{await h.close();}
});
test('more than 8 model milestones produce explicit bounded error, not silent truncation',async()=>{
 const text='Project: Fixed-price workshops. '+Array.from({length:9},(_,i)=>`Milestone ${i+1}: Workshop ${i+1} fee USD 100 after acceptance.`).join(' ');
 const h=await harness(()=>({...model(text),milestones:Array.from({length:9},(_,i)=>({title:`Workshop ${i+1}`,amount:'100',source_excerpt:`Milestone ${i+1}: Workshop ${i+1} fee USD 100 after acceptance`,trigger:'acceptance'}))}));try{
  const r=await h.request('/api/analyze',{contractText:text});assert.equal(r.status,422);assert.match(r.body.error,/at most 8/);
 }finally{await h.close();}
});


test('saved pre-repair financial eligibility must be reanalyzed under revised policy',()=>{
 const p=createProject({currency:'USD',summary:'Legacy source',milestones:[{title:'Report',amount:'500.00',source_excerpt:'Milestone 1: Report fee USD 500',amount_verification:'verified',evidence_matched:true,financialPolicyVersion:5,financialRiskCodes:[]}]},'Legacy');
 const m=p.milestones[0];m.approvalStatus='approved';
 assert.equal(m.financialPolicyRevision,FINANCIAL_POLICY_REVISION);
 m.financialPolicyRevision='2026-10-15-nonbinding-conflict-credit';
 assert.equal(stateOf(m).code,'blocked');
});
