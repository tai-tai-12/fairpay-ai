/** Sprint A equivalents of historical v186 intents. Loopback mock providers only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {reconcileSyntheticGross,grossAuthorization} from './support/receivable-fixture.mjs';
const source='Synthetic Sprint A. Milestone 1: Accepted report fee USD 500 after actual client acceptance.';
const buyer='sprint-a@example.test',id='INV2-SPRINTA-12345678';
const extract=()=>({project_summary:'Synthetic Sprint A',currency_code:'USD',warnings:[],milestones:[{title:'Report',trigger:'acceptance',amount:'500',source_excerpt:source}]});
const detail=(status='DRAFT',value='500.00')=>({id,status,amount:{currency_code:'USD',value},due_amount:{currency_code:'USD',value:status==='PAID'?'0.00':value},primary_recipients:[{billing_info:{email_address:buyer}}]});
async function prepared(h){const a=await h.request('/api/analyze',{contractText:source});assert.equal(a.status,200);const save=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Synthetic Sprint A',persistEvidence:true});assert.equal(save.status,201);const p=save.body.project,base=`/api/projects/${p.id}`,revision=await reconcileSyntheticGross(h,p);assert.equal((await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId})).status,200);return {p,base,body:{milestoneIndex:0,recipientEmail:buyer,...grossAuthorization(p,revision)}};}
const bounded=async(p,ms=3000)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Mock event deadline exceeded')),ms))]);}finally{clearTimeout(timer);}};
function provider(read,create){return async(req,res,json)=>{if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});if(req.method==='POST')return create(req,res,json);return read(req,res,json);};}
const opts={timeout:10000};
test('A1-01 mismatched/missing PAID readbacks never count as revenue; valid refresh recovers same ID',opts,async()=>{
 let response=detail(),writes=0;const h=await harness(extract,provider((req,res,json)=>json(res,response),(req,res,json)=>{writes++;json(res,{id},201);}));
 try{const {base,body}=await prepared(h);assert.equal((await h.request(base+'/drafts',body)).status,201);
 for(const r of [detail('PAID','5.00'),{id,status:'PAID'},{...detail('PAID'),primary_recipients:[]}]){response=r;const out=await h.request(base+`/invoices/${id}/refresh`,{});assert.equal(out.status,200);const p=out.body.project;assert.equal(p.milestones[0].invoices[0].status,'UNKNOWN');assert.equal(p.milestones[0].invoices[0].invoiceId,id);assert.equal(p.summary.confirmedPaidCents,0);assert.equal((await h.request(base+'/drafts',body)).status,400);assert.equal(p.decisionHistory.at(-1).type,'invoice_reconciliation_required');}
 response=detail('PAID');const p=(await h.request(base+`/invoices/${id}/refresh`,{})).body.project;assert.equal(p.summary.confirmedPaidCents,50000);assert.equal(p.milestones[0].readiness.code,'paid');assert.equal(writes,1);
 }finally{await h.close();}
});
test('A1-02 parallel refresh serializes delayed old snapshot before newer PAID; no stale overwrite',opts,async()=>{
 let reads=0,writes=0,active=0,max=0;const h=await harness(extract,provider(async(req,res,json)=>{const n=++reads;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,n===2?100:5));active--;json(res,detail(n>=3?'PAID':'DRAFT'));},(req,res,json)=>{writes++;json(res,{id},201);}));
 try{const {base,body}=await prepared(h);assert.equal((await h.request(base+'/drafts',body)).status,201);const url=base+`/invoices/${id}/refresh`;const replies=await bounded(Promise.all([h.request(url,{}),h.request(url,{})]));assert.deepEqual(replies.map(r=>r.status),[200,200]);const p=(await h.request(base)).body.project;assert.equal(max,1);assert.equal(reads,3);assert.equal(writes,1);assert.equal(p.milestones[0].invoices[0].status,'PAID');assert.deepEqual(p.milestones[0].invoices[0].statusHistory.map(e=>e.status),['DRAFT','PAID']);
 }finally{await h.close();}
});
test('A1-03 in-flight authorization rejects acceptance/amendment/ledger mutation and duplicate create',opts,async()=>{
 let signal,release,writes=0;const started=new Promise(r=>signal=r);const held=new Promise(r=>release=r);const h=await harness(extract,provider((req,res,json)=>json(res,detail()),async(req,res,json)=>{writes++;signal();await held;json(res,{id},201);}));
 try{const {p,base,body}=await prepared(h);const pending=h.request(base+'/drafts',body);await bounded(started);
 const mutations=[['/milestones/0/approval',{status:'pending',agreementVersionId:p.agreementVersionId}],['/milestones/0/amendment',{confirmed:true,agreementVersionId:p.agreementVersionId}],['/receivable',{confirmed:true,expectedRevision:body.ledgerRevisionId,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic complete replacement review'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,amount:m.amount,currency:'USD',humanVerified:true,reference:m.source_excerpt})),credits:[]}],['/drafts',body]];
 for(const [route,data] of mutations)assert.equal((await h.request(base+route,data)).status,400,route);
 release();assert.equal((await bounded(pending)).status,201);const current=(await h.request(base)).body.project;assert.equal(current.milestones[0].approvalStatus,'approved');assert.equal(current.receivableLedger.id,body.ledgerRevisionId);assert.equal(current.milestones[0].invoices[0].authorization.amountMinor,50000);assert.equal(writes,1);
 for(const [route,data] of mutations)assert.equal((await h.request(base+route,data)).status,400,'after creation '+route);
 }finally{release();await h.close();}
});
test('A1-04 ambiguous create without ID remains uncertain and repeated/concurrent retries never write twice',opts,async()=>{
 let writes=0;const h=await harness(extract,provider((req,res,json)=>json(res,{}),(req,res,json)=>{writes++;json(res,{},201);}));
 try{const {base,body}=await prepared(h);assert.equal((await h.request(base+'/drafts',body)).status,502);const replies=await bounded(Promise.all(Array.from({length:4},()=>h.request(base+'/drafts',body))));assert.ok(replies.every(r=>r.status===400));const p=(await h.request(base)).body.project;assert.equal(p.milestones[0].creationState,'uncertain');assert.equal(p.milestones[0].invoices.length,0);assert.equal(writes,1);
 }finally{await h.close();}
});
test('A1-05 returned ID with UNKNOWN readback locks create, refresh recovers without second write',opts,async()=>{
 let response={id,status:'DRAFT'},writes=0;const h=await harness(extract,provider((req,res,json)=>json(res,response),(req,res,json)=>{writes++;json(res,{id},201);}));
 try{const {base,body}=await prepared(h);const first=await h.request(base+'/drafts',body);assert.equal(first.status,201);assert.equal(first.body.status,'UNKNOWN');assert.equal((await h.request(base+'/drafts',body)).status,400);response=detail();const r=await h.request(base+`/invoices/${id}/refresh`,{});assert.equal(r.body.invoice.status,'DRAFT');assert.equal(r.body.project.milestones[0].invoices.length,1);assert.equal(writes,1);
 }finally{await h.close();}
});
test('A1-06 failed refresh preserves last-known evidence and records failure without implying new verification',opts,async()=>{
 let fail=false,writes=0;const h=await harness(extract,provider((req,res,json)=>fail?json(res,{},503):json(res,detail()),(req,res,json)=>{writes++;json(res,{id},201);}));
 try{const {base,body}=await prepared(h);await h.request(base+'/drafts',body);const before=(await h.request(base)).body.project.milestones[0].invoices[0];fail=true;assert.equal((await h.request(base+`/invoices/${id}/refresh`,{})).status,502);const p=(await h.request(base)).body.project;assert.deepEqual(p.milestones[0].invoices[0],before);assert.equal(p.decisionHistory.at(-1).type,'invoice_refresh_failed');assert.equal(writes,1);
 }finally{await h.close();}
});
