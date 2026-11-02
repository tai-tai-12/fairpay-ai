import test from 'node:test';
import assert from 'node:assert/strict';
import {minorUnits,decimalUnits,calculateReceivable,recordReceivable} from '../receivables.mjs';
import {FINANCIAL_POLICY_REVISION} from '../financial-policy.mjs';
import {stateOf} from '../project-model.mjs';
import {harness} from './support/server.mjs';
const quote='Milestone 1: Written report costs USD 10.05 after acceptance.';
const project=()=>({id:'synthetic',currency:'USD',agreementVersionId:'v1',milestones:[{canonicalId:'m1',amount:'10.05',source_excerpt:quote,approvalStatus:'approved',invoices:[]}]});
const input=()=>({confirmed:true,expectedRevision:null,agreementVersionId:'v1',complete:true,confirmation:{humanVerified:true,reference:'Synthetic accounting review only'},gross:[{milestoneId:'m1',amount:'10.05',currency:'USD',humanVerified:true,reference:quote}],credits:[]});
const ledger=()=>({...input(),policyRevision:FINANCIAL_POLICY_REVISION});
test('FP-09 exact minor units reject coercion, precision, signs, FX and overflow',()=>{
 assert.equal(minorUnits('0.10','USD')+minorUnits('0.20','USD'),30);assert.equal(decimalUnits(30,'USD'),'0.30');assert.equal(minorUnits('1234','JPY'),1234);
 for(const [v,c] of [[1,'USD'],['1e2','USD'],['01','USD'],['1.001','USD'],['1.2','JPY'],['-1','USD'],[' 1','USD'],['999999999','USD'],['1','EUR']])assert.throws(()=>minorUnits(v,c));
 for(let cents=0;cents<100000;cents+=37)assert.equal(minorUnits(decimalUnits(cents,'USD'),'USD'),cents);
});
test('FP-01R unknown never zero and evidence completeness/version/precedence cannot be inferred',()=>{
 assert.equal(calculateReceivable(project(),null).outstandingMinor,null);
 for(const change of [{complete:false},{agreementVersionId:'old'},{policyRevision:'old'},{confirmation:{humanVerified:false,reference:'synthetic'}},{gross:[]}])assert.equal(calculateReceivable(project(),{...ledger(),...change}).status,'UNVERIFIED');
});
test('FP-02R allocations conserve credit and cannot double count or mix currencies',()=>{
 const l=ledger();l.credits=[{id:'credit-1',kind:'deposit',amount:'0.10',currency:'USD',humanVerified:true,reference:'Synthetic receipt reference',allocations:[{milestoneId:'m1',amount:'0.10'}]}];
 assert.equal(calculateReceivable(project(),l).outstandingMinor,995);
 for(const edit of [x=>x.credits.push(structuredClone(x.credits[0])),x=>x.credits[0].currency='JPY',x=>x.credits[0].allocations.push({milestoneId:'m1',amount:'0.10'}),x=>x.credits[0].amount='0.20',x=>x.credits[0].humanVerified=false,x=>x.credits[0].kind='refund']){const copy=structuredClone(l);edit(copy);assert.equal(calculateReceivable(project(),copy).status,'UNVERIFIED');}
 for(let n=1;n<=1005;n++){const copy=structuredClone(l);copy.credits[0].amount=decimalUnits(n,'USD');copy.credits[0].allocations[0].amount=decimalUnits(n,'USD');assert.equal(calculateReceivable(project(),copy).outstandingMinor,1005-n);}
});
test('FP-07R ledger edits invalidate acceptance, stale replay rejects, net mismatch blocks gross draft',()=>{
 const p=project(),d=input();d.credits=[{id:'paid',kind:'partial_payment',amount:'0.10',currency:'USD',humanVerified:true,reference:'Synthetic paid record',allocations:[{milestoneId:'m1',amount:'0.10'}]}];recordReceivable(p,d);
 assert.equal(p.milestones[0].approvalStatus,'pending');assert.equal(stateOf(p.milestones[0]).code,'blocked');assert.equal(p.receivableHistory.length,1);assert.throws(()=>recordReceivable(p,d),/revision/);
 p.milestones[0].invoices=[{invoiceId:'synthetic'}];assert.throws(()=>recordReceivable(p,{...d,expectedRevision:p.receivableLedger.id}));
});
test('FP-01R HTTP ledger requires consent/current version and never calls PayPal',async()=>{
 const h=await harness(()=>({project_summary:'Synthetic',currency_code:'USD',warnings:[],milestones:[{title:'Written report',amount:'10.05',trigger:'acceptance',source_excerpt:quote}]}));
 try{const a=await h.request('/api/analyze',{contractText:quote});const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic ledger',persistEvidence:true});const p=saved.body.project;const d=input();d.agreementVersionId=p.agreementVersionId;d.gross[0].milestoneId=p.milestones[0].canonicalId;
 assert.equal((await h.request(`/api/projects/${p.id}/receivable`,{...d,confirmed:false})).status,400);
 const result=await h.request(`/api/projects/${p.id}/receivable`,d);assert.equal(result.status,200);assert.equal(result.body.project.receivable.outstandingMinor,1005);assert.equal(result.body.project.receivable.authorizesInvoice,false);assert.equal(result.body.project.decisionHistory.at(-1).actor,'local_user');
 assert.equal((await h.request(`/api/projects/${p.id}/receivable`,d)).status,400);assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});
