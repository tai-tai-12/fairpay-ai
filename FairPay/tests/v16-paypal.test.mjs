import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {createPaypalAdapter} from '../paypal-adapter.mjs';
const id='INV2-SYNTHETIC-12345678';
const text='Project: Synthetic cedar report. Milestone 1: Accepted report costs USD 620, billable after actual client acceptance.';
const extract=()=>({project_summary:'Cedar',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'620',trigger:'acceptance',source_excerpt:text}]});
async function ready(h){const a=await h.request('/api/analyze',{contractText:text});const p=(await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Cedar'})).body.project;await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved'});return p;}
const auth={milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true};
test('v1.6 adapter rejects production hosts and strips unrelated/private response fields',async()=>{
 assert.throws(()=>createPaypalAdapter({base:'https://api-m.paypal.com'}),/Sandbox/);
 const adapter=createPaypalAdapter({base:'http://127.0.0.1:9999',credentials:()=>({id:'mock',secret:'mock'}),error:(message)=>Error(message),remoteJson:async()=>({result:{id,status:'PAID',amount:{currency_code:'USD',value:'620.00'},due_amount:{currency_code:'USD',value:'0.00'},invoicer:{tax_id:'DO_NOT_EXPOSE'},primary_recipients:[{email:'DO_NOT_EXPOSE'}],detail:{memo:'DO_NOT_EXPOSE',metadata:{create_time:'2026-01-01T00:00:00Z'}}}})});
 const result=await adapter.read(id,'mock');assert.equal(result.total.value,'620.00');assert.equal(result.dueAmount.value,'0.00');assert.equal(JSON.stringify(result).includes('DO_NOT_EXPOSE'),false);
});
test('v1.6 status read-back validates identity, preserves failed refresh state and records transitions',async()=>{
 let status='DRAFT',badId=false,fail=false,creates=0,key;const h=await harness(extract,(req,res,json)=>{
 if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
 if(req.method==='POST'){creates++;key=req.headers['paypal-request-id'];return json(res,{id},201);}
 if(fail)return json(res,{private:'NEVER_ECHO'},503);
 return json(res,{id:badId?'INV2-WRONG-12345678':id,status,amount:{currency_code:'USD',value:'620.00'},due_amount:{currency_code:'USD',value:status==='PAID'?'0.00':'620.00'}});
 });try{const p=await ready(h),url=`/api/projects/${p.id}`;const [a,b]=await Promise.all([h.request(url+'/drafts',auth),h.request(url+'/drafts',auth)]);assert.deepEqual([a.status,b.status].sort(),[201,400]);assert.equal(creates,1);assert.match(key,/^[a-f0-9-]{36}$/);
 const refresh=()=>h.request(url+`/invoices/${id}/refresh`,{});badId=true;assert.equal((await refresh()).status,502);assert.equal((await h.request(url)).body.project.milestones[0].invoices[0].status,'DRAFT');badId=false;fail=true;const failed=await refresh();assert.equal(failed.status,502);assert.equal(JSON.stringify(failed.body).includes('NEVER_ECHO'),false);fail=false;
 for(status of ['SENT','PARTIALLY_PAID','PAID','MARKED_AS_PAID']){const r=await refresh();assert.equal(r.status,200);assert.equal(r.body.project.summary.confirmedPaidCents,status==='PAID'?62000:0);assert.equal(r.body.project.milestones[0].invoices[0].status,status);}
 const inv=(await h.request(url)).body.project.milestones[0].invoices[0];assert.equal(inv.statusHistory.length,5);assert.equal(inv.statusHistory.at(-1).source,'PayPal Sandbox read-back');assert.equal(creates,1);
 }finally{await h.close();}
});
test('v1.6 OAuth failure is safely retryable; ambiguous creation is never automatically repeated',async()=>{
 let tokenFails=true,createFails=false,creates=0;const h=await harness(extract,(req,res,json)=>{
 if(req.url==='/v1/oauth2/token')return json(res,tokenFails?{}:{access_token:'mock'},tokenFails?503:200);
 if(req.method==='POST'){creates++;return json(res,createFails?{}:{id},createFails?503:201);}return json(res,{id,status:'DRAFT'});
 });try{const p=await ready(h),url=`/api/projects/${p.id}`;assert.equal((await h.request(url+'/drafts',auth)).status,502);assert.equal(creates,0);assert.equal((await h.request(url)).body.project.milestones[0].readiness.code,'ready');tokenFails=false;createFails=true;assert.equal((await h.request(url+'/drafts',auth)).status,502);assert.equal((await h.request(url)).body.project.milestones[0].readiness.code,'uncertain');createFails=false;assert.equal((await h.request(url+'/drafts',auth)).status,400);assert.equal(creates,1);
 }finally{await h.close();}
});
test('v1.6 accepted creation with failed read-back stays UNKNOWN and can recover by refresh',async()=>{
 let fail=true,creates=0;const h=await harness(extract,(req,res,json)=>{if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});if(req.method==='POST'){creates++;return json(res,{id},201);}return json(res,fail?{}:{id,status:'DRAFT'},fail?503:200);});
 try{const p=await ready(h),url=`/api/projects/${p.id}`;const r=await h.request(url+'/drafts',auth);assert.equal(r.status,201);assert.equal(r.body.status,'UNKNOWN');assert.equal(r.body.project.milestones[0].invoices[0].lastVerifiedAt,null);fail=false;const refreshed=await h.request(url+`/invoices/${id}/refresh`,{});assert.equal(refreshed.body.invoice.status,'DRAFT');assert.equal(creates,1);}finally{await h.close();}
});
