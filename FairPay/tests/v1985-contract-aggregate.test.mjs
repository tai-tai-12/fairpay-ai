import test from 'node:test';
import assert from 'node:assert/strict';
import {assessContractAggregate} from '../contract-invariants.mjs';
import {harness} from './support/server.mjs';
import {createProject,draftFinancialReview} from '../project-model.mjs';
import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {recordReceivable} from '../receivables.mjs';
const quoted=(x)=>({amount:String(x),amount_verification:'verified',evidence_matched:true});
const risk=(text,amounts)=>assessContractAggregate(text,amounts.map(quoted));
const over='Total contract amount: USD 3,000.\nMilestone 1: UX delivery fee USD 1200.\nMilestone 2: Backend delivery fee USD 1200.\nMilestone 3: Testing delivery fee USD 1200.';
const good='Total contract amount: USD 3,600.\nMilestone 1: UX delivery fee USD 1200.\nMilestone 2: Backend delivery fee USD 1200.\nMilestone 3: Testing delivery fee USD 1200.';
const partial='Not to exceed USD 5,000.\nMilestone 1: UX delivery fee USD 1200.\nMilestone 2: Backend delivery fee USD 1200.';
test('TRUST85-01 explicit contract cap prevents USD 3600 installments against USD 3000 cap',()=>{
 const x=risk(over,['1200','1200','1200']);assert.equal(x.status,'blocked');assert.equal(x.riskCodes[0],'CONTRACT_TOTAL_CAP_EXCEEDED');assert.equal(x.sumMinor,360000);assert.equal(x.capMinor,300000);
});
test('TRUST85-02 exactly matching full total is eligible for ordinary independent checks',()=>assert.equal(risk(good,['1200','1200','1200']).status,'clear'));
test('TRUST85-03 partial contracted phases are not incorrectly required to exhaust project budget',()=>assert.equal(risk(partial,['1200','1200']).status,'clear'));
test('TRUST85-04 ordinary contract with no explicit global total is unchanged',()=>assert.equal(risk('Milestone 1: USD 500. Milestone 2: USD 800.',['500','800']).status,'not_applicable'));
test('TRUST85-05 ambiguous USD cap and unverified milestones fail closed',()=>{
 assert.equal(risk('Contract total: TBD. Milestone 1: USD 500.',['500']).riskCodes[0],'CONTRACT_TOTAL_REVIEW_REQUIRED');
 assert.equal(assessContractAggregate('Total contract value USD 3000. Milestone 1: USD 1200.',[quoted('1200'),{amount:null,evidence_matched:false}]).status,'blocked');
});
test('TRUST85-06 float, negative and invalid amounts never become trusted aggregate values',()=>{
 assert.equal(assessContractAggregate('Contract total: USD 100.00.',[quoted('33.333')]).status,'blocked');
 assert.equal(assessContractAggregate('Contract total: USD 100.00.',[quoted('-1')]).status,'blocked');
});
test('TRUST85-07 API analysis refuses an aggregate-over-cap contract even with individually source-matched amounts',async()=>{
 const clauses=['Milestone 1: UX delivery fee USD 1200.','Milestone 2: Backend delivery fee USD 1200.','Milestone 3: Testing delivery fee USD 1200.'];
 const h=await harness(()=>({project_summary:'Synthetic capped scope',currency_code:'USD',warnings:[],milestones:clauses.map((source_excerpt,i)=>({title:`Delivery ${i+1}`,amount:'1200',trigger:'client acceptance',source_excerpt}))}));
 try{
 const a=await h.request('/api/analyze',{contractText:over});assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(a.body.milestones.length,3);
 for(const m of a.body.milestones){assert.equal(m.amount,null);assert.ok(m.financialRiskCodes.includes('CONTRACT_TOTAL_CAP_EXCEEDED'));}
 const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Overcap synthetic',persistEvidence:true});assert.equal(saved.status,201);
 assert.ok(saved.body.project.milestones.every(m=>m.amount===null));
 }finally{await h.close();}
});
test('TRUST85-08 a previously stored current source is rechecked at authorization-time without any provider call',()=>{
 const text=over;
 const p=createProject({summary:'capped',currency:'USD',milestones:[1,2,3].map(i=>({title:`Delivery ${i}`,amount:'1200.00',trigger:'acceptance',source_excerpt:`Milestone ${i}: ${i===1?'UX':i===2?'Backend':'Testing'} delivery fee USD 1200.`,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}))});
 p.agreementVersionId='stored-v1';p.agreementVersions=[{id:'stored-v1',sourceText:text}];
 const gross=p.milestones.map(m=>({milestoneId:m.canonicalId,currency:'USD',amount:m.amount,humanVerified:true,reference:m.source_excerpt + ' (Synthetic fixed-price review)'}));
 recordReceivable(p,{confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic reviewer'},gross,credits:[]});
 assert.equal(draftFinancialReview(p,p.milestones[0]).eligible,false);
 assert.match(draftFinancialReview(p,p.milestones[0]).reason,/contract-wide financial review/i);
});
