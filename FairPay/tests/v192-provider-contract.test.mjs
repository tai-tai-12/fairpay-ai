import test from 'node:test';import assert from 'node:assert/strict';
import {createPaypalAdapter} from '../paypal-adapter.mjs';import {reconcileInvoice} from '../payment-integrity.mjs';import {harness} from './support/server.mjs';
import {reconcileSyntheticGross,grossAuthorization} from './support/receivable-fixture.mjs';
const id='INV2-NEW-TEST12345678',recipient='synthetic@example.test';
const full=()=>({id,status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:recipient}}]});
const adapter=response=>createPaypalAdapter({base:'http://127.0.0.1:9999',credentials:()=>({id:'mock',secret:'mock'}),error:message=>Error(message),remoteJson:async(url,options)=>({result:url.endsWith('/token')?{access_token:'mock'}:options?.method==='POST'?{id}:response,headers:new Headers()})});
test('FP-04R missing/ambiguous provider fields cannot validate DRAFT or PAID',async()=>{
 for(const status of ['DRAFT','PAID'])for(const mutate of [r=>delete r.amount,r=>delete r.amount.currency_code,r=>delete r.primary_recipients,r=>r.primary_recipients=[],r=>r.primary_recipients[0].billing_info.email_address='',r=>r.primary_recipients.push(r.primary_recipients[0]),r=>delete r.status]){
 const r=full();r.status=status;mutate(r);const seen=await adapter(r).create({title:'Synthetic',amount:'500.00',recipientEmail:recipient});assert.equal(seen.status,'UNKNOWN');assert.equal(seen.verifiedAt,null);assert.equal(seen.invoiceId,id);
 }
});
test('FP-04R exact amount equality accepts decimal equivalence but never different currency/recipient',async()=>{
 const r=full();r.amount.value='500';assert.equal((await adapter(r).create({title:'Synthetic',amount:'500.00',recipientEmail:recipient})).status,'DRAFT');
 for(const mutate of [r=>r.amount.currency_code='JPY',r=>r.amount.value='501',r=>r.primary_recipients[0].billing_info.email_address='other@example.test']){const r=full();mutate(r);assert.equal((await adapter(r).create({title:'Synthetic',amount:'500.00',recipientEmail:recipient})).status,'UNKNOWN');}
});
test('FP-04R legacy missing readback evidence cannot be MATCHED',()=>{
 const m={amount:'500.00'};assert.equal(reconcileInvoice(m,{invoiceId:id,status:'DRAFT'}).ok,false);
 assert.equal(reconcileInvoice(m,{invoiceId:id,status:'PAID',amount:'500.00',total:{currency:'USD',value:'500.00'},lastVerifiedAt:new Date().toISOString()}).ok,false);
});
const text='Project: Synthetic provider contract. Milestone 1: Written report USD 500 after actual acceptance.';
const extract=()=>({project_summary:'Synthetic',currency_code:'USD',warnings:[],milestones:[{title:'Written report',amount:'500',trigger:'acceptance',source_excerpt:text}]});
async function ready(h){const a=await h.request('/api/analyze',{contractText:text});const p=(await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic',persistEvidence:true})).body.project;const revision=await reconcileSyntheticGross(h,p);await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved',agreementVersionId:p.agreementVersionId});return {p,revision};}
test('FP-04I concurrent unknown 409/5xx writes remain locked with one POST',async()=>{
 for(const status of [409,500]){let writes=0;const h=await harness(extract,(req,res,json)=>{if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});if(req.method==='POST'){writes++;return json(res,{},status);}return json(res,full());});try{const {p,revision}=await ready(h),url=`/api/projects/${p.id}/drafts`,body={milestoneIndex:0,recipientEmail:recipient,...grossAuthorization(p,revision)};await Promise.all([h.request(url,body),h.request(url,body)]);assert.equal(writes,1);assert.equal((await h.request(url,body)).status,400);assert.equal(writes,1);assert.equal((await h.request(`/api/projects/${p.id}`)).body.project.milestones[0].creationState,'uncertain');}finally{await h.close();}}
});
test('FP-04R refresh omission preserves ID but never verified success; complete refresh recovers without POST',async()=>{
 let response=full(),writes=0;const h=await harness(extract,(req,res,json)=>{if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});if(req.method==='POST'){writes++;return json(res,{id},201);}return json(res,response);});try{const {p,revision}=await ready(h),url=`/api/projects/${p.id}`;assert.equal((await h.request(url+'/drafts',{milestoneIndex:0,recipientEmail:recipient,...grossAuthorization(p,revision)})).body.status,'DRAFT');response={id,status:'PAID'};let refreshed=await h.request(url+`/invoices/${id}/refresh`,{});assert.equal(refreshed.body.invoice.status,'UNKNOWN');assert.equal(refreshed.body.project.summary.confirmedPaidCents,0);response=full();refreshed=await h.request(url+`/invoices/${id}/refresh`,{});assert.equal(refreshed.body.invoice.status,'DRAFT');assert.equal(writes,1);}finally{await h.close();}
});
