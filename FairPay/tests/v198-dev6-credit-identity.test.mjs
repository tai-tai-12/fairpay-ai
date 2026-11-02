/** dev6: independent financial authorization and duplicate-credit adversarial regression.
 * Synthetic inputs, isolated loopback servers; no live payment or model calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {createProject,validateDraft} from '../project-model.mjs';
import {recordReceivable,calculateReceivable,assertUniqueCreditEvidence} from '../receivables.mjs';
import {prepareFinancialReview} from '../public/financial-review.mjs';
import {FINANCIAL_POLICY_VERSION,FINANCIAL_POLICY_REVISION} from '../financial-policy.mjs';

const excerpt='Milestone 1: Final signed report fee USD 500 after actual client acceptance.';
const project=()=>{const p=createProject({summary:'Synthetic',currency:'USD',milestones:[{title:'Report',amount:'500.00',trigger:'acceptance',source_excerpt:excerpt,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]});p.agreementVersionId='source-1';return p;};
function review(p,ref='Synthetic receipt 101',creditId='credit-101'){
 return {confirmed:true,expectedRevision:p.receivableLedger?.id||null,agreementVersionId:p.agreementVersionId,complete:true,
 confirmation:{humanVerified:true,reference:'Synthetic external accounting review completed'},
 gross:p.milestones.map(m=>({milestoneId:m.canonicalId,currency:'USD',amount:m.amount,humanVerified:true,reference:m.source_excerpt})),
 credits:[{id:creditId,kind:'deposit',amount:'100.00',currency:'USD',humanVerified:true,reference:ref,allocations:[{milestoneId:p.milestones[0].canonicalId,amount:'100.00'}]}]};
}
test('DEV6-01 duplicate human-recorded receipt reference within one ledger fails closed',()=>{
 const p=project(),l=review(p);
 l.credits.push({...l.credits[0],id:'different-credit-id',amount:'50.00',reference:'  synthetic    RECEIPT 101 ',allocations:[{milestoneId:p.milestones[0].canonicalId,amount:'50.00'}]});
 assert.match(calculateReceivable(p,{...l,id:'version-1',policyRevision:FINANCIAL_POLICY_REVISION,gross:l.gross}).reason,/Duplicate credit evidence/i);
 assert.throws(()=>recordReceivable(p,l),/Duplicate credit evidence/i);
});
test('DEV6-02 UI review refuses repeated receipt references even with different IDs',()=>{
 const p=project(),milestoneId=p.milestones[0].canonicalId;
 assert.throws(()=>prepareFinancialReview(p,'Synthetic confirmed accounting review',[
  {id:'a',kind:'deposit',milestoneId,amount:'100.00',reference:'Synthetic receipt #123'},
  {id:'b',kind:'credit',milestoneId,amount:'25.00',reference:' synthetic   RECEIPT #123  '}
 ]),/already entered/i);
});
test('DEV6-03 gross invoices require ledger revision AND typed amount, not only a checkbox',()=>{
 const p=project(),l={...review(p),credits:[]};recordReceivable(p,l);p.milestones[0].approvalStatus='approved';
 const recipient='synthetic@example.test',v=p.receivableLedger.id;
 for(const a of [{},{ledgerRevisionId:v},{ledgerRevisionId:'old',authorizedAmount:'500.00',netAmountConfirmed:true},{ledgerRevisionId:v,authorizedAmount:'499.99',netAmountConfirmed:true},{ledgerRevisionId:v,authorizedAmount:'500.00',netAmountConfirmed:false}])
  assert.throws(()=>validateDraft(p,0,recipient,true,a),/exact invoice amount/i);
 assert.equal(validateDraft(p,0,recipient,true,{ledgerRevisionId:v,authorizedAmount:'500.00',netAmountConfirmed:true}),p.milestones[0]);
});
const sourceA='Project: Synthetic North. Milestone 1: North report fee USD 500 after actual client acceptance.';
const sourceB='Project: Synthetic South. Milestone 1: South report fee USD 500 after actual client acceptance.';
const extract=contract=>({project_summary:contract.includes('North')?'North':'South',currency_code:'USD',warnings:[],milestones:[{title:contract.includes('North')?'North report':'South report',amount:'500',trigger:'client acceptance',source_excerpt:contract.split('. ').find(s=>s.includes('Milestone 1:'))?.replace(/\.$/,'')}]});
async function saved(h,text){const a=await h.request('/api/analyze',{contractText:text});assert.equal(a.status,200,JSON.stringify(a.body));const r=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic '+(text.includes('North')?'North':'South'),persistEvidence:true});assert.equal(r.status,201,JSON.stringify(r.body));return r.body.project;}
function payload(p,id='receipt-A',ref='Synthetic external bank statement 1001'){
 const row=review(p,ref,id);return row;
}
test('DEV6-04 same receipt cannot be counted twice across different projects; rejected transaction rolls back',async()=>{
 const h=await harness(extract);try{
  const a=await saved(h,sourceA),b=await saved(h,sourceB);
  const aUrl=`/api/projects/${a.id}`,bUrl=`/api/projects/${b.id}`;
  let r=await h.request(aUrl+'/receivable',payload(a));assert.equal(r.status,200,JSON.stringify(r.body));
  r=await h.request(bUrl+'/receivable',payload(b,'receipt-B',' synthetic   EXTERNAL bank STATEMENT 1001  '));assert.equal(r.status,400);assert.match(r.body.error,/duplicate credit across projects/i);
  assert.equal((await h.request(bUrl)).body.project.receivableLedger,undefined);
  r=await h.request(bUrl+'/receivable',payload(b,'receipt-A','A different synthetic statement 2002'));assert.equal(r.status,400);assert.match(r.body.error,/duplicate credit across projects/i);
  r=await h.request(bUrl+'/receivable',payload(b,'receipt-B','Entirely distinct synthetic statement 2002'));assert.equal(r.status,200,JSON.stringify(r.body));
 }finally{await h.close();}
});
test('DEV6-05 archived project receipts still prevent double application',async()=>{
 const h=await harness(extract);try{
  const a=await saved(h,sourceA),b=await saved(h,sourceB),aUrl=`/api/projects/${a.id}`,bUrl=`/api/projects/${b.id}`;
  assert.equal((await h.request(aUrl+'/receivable',payload(a))).status,200);
  assert.equal((await h.request(aUrl+'/archive',{})).status,200);
  const r=await h.request(bUrl+'/receivable',payload(b,'new-id','Synthetic external bank statement 1001'));
  assert.equal(r.status,400);assert.match(r.body.error,/duplicate credit across projects/i);
 }finally{await h.close();}
});
test('DEV6-06 concurrent use of same receipt across projects serializes and at most one ledger accepts it',async()=>{
 const h=await harness(extract);try{
  const a=await saved(h,sourceA),b=await saved(h,sourceB);
  const results=await Promise.all([h.request(`/api/projects/${a.id}/receivable`,payload(a)),h.request(`/api/projects/${b.id}/receivable`,payload(b,'different-id','Synthetic external bank statement 1001'))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  const both=await Promise.all([h.request(`/api/projects/${a.id}`),h.request(`/api/projects/${b.id}`)]);
  assert.equal(both.filter(r=>r.body.project.receivableLedger).length,1);
 }finally{await h.close();}
});

test('DEV6-07 pre-existing legacy ledgers with same external receipt must fail an authorization-time uniqueness check',()=>{
 const a=project(),b=project();a.id='a';b.id='b';
 recordReceivable(a,review(a,'Historical statement reference 700','a-id'));
 recordReceivable(b,review(b,'  historical   STATEMENT reference 700  ','b-id'));
 assert.throws(()=>assertUniqueCreditEvidence(a.id,a.receivableLedger.credits,[a,b]),/duplicate credit across projects/i);
 assert.throws(()=>assertUniqueCreditEvidence(b.id,b.receivableLedger.credits,[a,b]),/duplicate credit across projects/i);
});
