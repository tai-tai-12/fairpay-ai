import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareFinancialReview,formatExactUsd,parseExactUsd} from '../public/financial-review.mjs';
import {createProject, publicProject, validateDraft, stateOf} from '../project-model.mjs';
import {recordReceivable} from '../receivables.mjs';
import {FINANCIAL_POLICY_REVISION,FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {harness} from './support/server.mjs';
const evidence='Milestone 1: Report fee USD 500 after acceptance.';
const p=()=>{
 const result=createProject({summary:'Synthetic',currency:'USD',milestones:[{title:'Report',amount:'500.00',trigger:'client acceptance',source_excerpt:evidence,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});
 result.agreementVersionId='source-v1';return result;
};
test('DEV4-UX1 exact USD formatting and conservative form validation',()=>{
 assert.equal(formatExactUsd(1),'0.01');assert.equal(parseExactUsd('0.01'),1);
 assert.equal(formatExactUsd(parseExactUsd('99.99')),'99.99');
 for(const item of ['-1','1e2','1,000','1.123','+1',' 10','010',''])assert.throws(()=>parseExactUsd(item));
});
test('DEV4-UX2 form calculates conservation of credits and refuses overallocations or untraceable records',()=>{
 const project=p(),id=project.milestones[0].canonicalId;
 const c={id:'synthetic-1',kind:'deposit',milestoneId:id,amount:'100.00',reference:'Synthetic external receipt #101'};
 const prepared=prepareFinancialReview(project,'Synthetic ledger review #001',[c]);
 assert.equal(prepared.grossMinor,50000);assert.equal(prepared.creditedMinor,10000);assert.equal(prepared.outstandingMinor,40000);
 assert.equal(prepared.credits[0].allocations[0].amount,'100.00');
 for(const row of [{...c,amount:'500.01'},{...c,kind:'refund'},{...c,reference:'no'}, {...c,amount:'-1'},{...c,milestoneId:'another'}])assert.throws(()=>prepareFinancialReview(project,'Synthetic ledger review #001',[row]));
 assert.throws(()=>prepareFinancialReview(project,'Synthetic ledger review #001',[c,c]),/unique/i);
});
test('DEV5-MIGRATED-UX3 after saving credited ledger, gross draft bypass is blocked, net eligibility requires exact authorization',()=>{
 const project=p();const row={id:'synthetic-deposit',kind:'deposit',milestoneId:project.milestones[0].canonicalId,amount:'100.00',reference:'Synthetic paid deposit receipt'};
 const r=prepareFinancialReview(project,'Synthetic reconciliation reference',[row]);
 recordReceivable(project,{confirmed:true,expectedRevision:null,agreementVersionId:project.agreementVersionId,complete:true,...r});
 project.milestones[0].approvalStatus='approved';
 const response=publicProject(project);
 assert.equal(response.receivable.creditedMinor,10000);
 assert.equal(response.receivable.outstandingMinor,40000);
 assert.equal(response.milestones[0].readiness.code,'ready');
 assert.equal(response.summary.readyToDraftCents,40000);
 assert.throws(()=>validateDraft(project,0,'synthetic@example.test',true),/blocked|receivable/i);
});
test('DEV4-UX4 stale no-credit source can be reconciled again with exact revision; previously recorded credits cannot be discarded',()=>{
 const project=p();
 const initial=prepareFinancialReview(project,'Synthetic completed prior review',[]);
 recordReceivable(project,{confirmed:true,expectedRevision:null,agreementVersionId:project.agreementVersionId,complete:true,...initial});
 const oldRevision=project.receivableLedger.id;
 project.agreementVersionId='source-v2';project.milestones[0].approvalStatus='approved';
 assert.equal(publicProject(project).milestones[0].readiness.code,'blocked');
 const newReview=prepareFinancialReview(project,'Synthetic re-review for source v2',[]);
 assert.throws(()=>recordReceivable(project,{confirmed:true,expectedRevision:null,agreementVersionId:'source-v2',complete:true,...newReview}),/revision/);
 recordReceivable(project,{confirmed:true,expectedRevision:oldRevision,agreementVersionId:'source-v2',complete:true,...newReview});
 assert.equal(project.milestones[0].approvalStatus,'pending');assert.equal(project.receivableHistory.length,2);
 const withCredit=prepareFinancialReview(project,'Synthetic second review with payment',[{id:'credit-2',kind:'deposit',milestoneId:project.milestones[0].canonicalId,amount:'20.00',reference:'Synthetic deposit receipt #02'}]);
 recordReceivable(project,{confirmed:true,expectedRevision:project.receivableLedger.id,agreementVersionId:'source-v2',complete:true,...withCredit});
 assert.throws(()=>recordReceivable(project,{confirmed:true,expectedRevision:project.receivableLedger.id,agreementVersionId:'source-v2',complete:true,...newReview}),/cannot be removed/i);
});
test('DEV4-UX5 new frontend module is served as a same-origin JavaScript resource',async()=>{
 const h=await harness(()=>({project_summary:'Synthetic',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'500',trigger:'acceptance',source_excerpt:evidence}]}));
 try{const r=await fetch(`http://127.0.0.1:${h.port}/financial-review.mjs`);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);assert.match(await r.text(),/prepareFinancialReview/);}finally{await h.close();}
});
test('DEV4-UX6 malformed legacy persisted receivable amount never crashes the dashboard',()=>{
 const item={amount:'not-a-money-value',invoices:[],approvalStatus:'pending',receivableOutstandingMinor:1000};
 assert.equal(stateOf(item).code,'blocked');
});

test('DEV4-UX7 source model refuses silent loss of ninth milestone',()=>{
 const input={currency:'USD',milestones:Array.from({length:9},(_,i)=>({title:`Milestone ${i+1}`,amount:'1.00',source_excerpt:'synthetic evidence'}))};
 assert.throws(()=>createProject(input),/8 milestones|silently discard/);
});
