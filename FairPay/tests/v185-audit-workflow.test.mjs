import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {timelineEvents,eventDetails,safeAuditMarkdown} from '../public/activity-view.mjs';
import {audit} from '../agreement-evidence.mjs';
const source='Project: Synthetic maple research. Milestone 1: Written report costs USD 620, billable after actual client acceptance.';
const extract=txt=>({project_summary:'Maple',currency_code:'USD',warnings:[],milestones:[{title:'Written report',amount:'620',trigger:'client acceptance',source_excerpt:txt}]});
const invoiceId='INV2-SYNTHETIC-12345678';
async function save(h,persistEvidence=true){const a=await h.request('/api/analyze',{contractText:source});assert.equal(a.status,200);const r=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Maple',persistEvidence});assert.equal(r.status,201);return r.body.project;}
test('v1.8.5 typed audit identifies saved project, version, actor and no unconsented full source',async()=>{
 const h=await harness(extract);try{const p=await save(h,false);const a=p.decisionHistory.at(-1);assert.equal(a.type,'project_saved');assert.equal(a.actor,'local_user');assert.equal(a.outcome,'recorded');assert.equal(a.projectId,p.id);assert.equal(p.agreementVersions,undefined);assert.equal(a.agreementVersionId,null);
 assert.equal(JSON.stringify(p.decisionHistory).includes(source),false);const md=safeAuditMarkdown(p);assert.match(md,/Review saved/);assert.doesNotMatch(md,/client acceptance\./);assert.equal(timelineEvents(p,'project').length,1);
 const legacy=eventDetails({type:'analysis_recorded',at:'2026-01-01T00:00:00Z'});assert.match(legacy.actor,/legacy/);
 }finally{await h.close();}
});
test('v1.8.5 stored evidence, source version, reanalysis failure and management actions remain accurately logged',async()=>{
 const h=await harness(text=>{if(text.includes('BROKEN'))throw Error('mock AI down');return extract(text);});try{
 const p=await save(h,true),url=`/api/projects/${p.id}`;assert.ok(p.agreementVersions[0].sourceText.includes('USD 620'));
 const initialId=p.milestones[0].canonicalId;
 await h.request(url+'/rename',{name:'Maple research'});
 await h.request(url+'/rename',{name:'Maple research'}); // idempotent rename not duplicated
 await h.request(url+'/archive',{});await h.request(url+'/archive',{});await h.request(url+'/restore',{});
 let state=(await h.request(url)).body.project;
 assert.equal(state.decisionHistory.filter(e=>e.type==='project_renamed').length,1);
 assert.equal(state.decisionHistory.filter(e=>e.type==='project_archived').length,1);
 assert.equal(state.decisionHistory.filter(e=>e.type==='project_restored').length,1);
 const bad=await h.request(url+'/reanalyze',{contractText:source+' BROKEN',persistEvidence:true,agreementVersionId:state.agreementVersionId});assert.equal(bad.status,502);
 state=(await h.request(url)).body.project;
 assert.equal(state.milestones[0].readiness.code,'blocked');assert.equal(state.milestones[0].canonicalId,initialId);
 assert.ok(state.decisionHistory.some(e=>e.type==='reanalysis_requested'&&e.outcome==='pending'));
 assert.ok(state.decisionHistory.some(e=>e.type==='reanalysis_failed'&&e.outcome==='failed'));
 assert.equal(state.decisionHistory.every(e=>e.projectId===p.id),true);
 }finally{await h.close();}
});
test('v1.8.5 distinguishes user authorization, confirmed creation, unchanged read-back, refresh failure and changed status',async()=>{
 let status='DRAFT',failRefresh=false,created=0;
 const h=await harness(extract,(req,res,json)=>{
  if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
  if(req.method==='POST'){created++;return json(res,{id:invoiceId},201);}
  if(failRefresh)return json(res,{},503);
  return json(res,{id:invoiceId,status,amount:{currency_code:'USD',value:'620.00'},due_amount:{currency_code:'USD',value:status==='PAID'?'0.00':'620.00'}});
 });try{
  const p=await save(h,true),url=`/api/projects/${p.id}`;
  await h.request(url+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});
  const createdResult=await h.request(url+'/drafts',{milestoneIndex:0,confirmed:true,agreementVersionId:p.agreementVersionId,recipientEmail:'synthetic@example.test'});
  assert.equal(createdResult.status,201);assert.equal(created,1);
  let current=(await h.request(url)).body.project;
  const types=current.decisionHistory.map(e=>e.type);
  assert.ok(types.includes('draft_authorized'));assert.ok(types.includes('draft_created'));
  const auth=current.decisionHistory.find(e=>e.type==='draft_authorized');const done=current.decisionHistory.find(e=>e.type==='draft_created');
  assert.equal(auth.outcome,'authorized_only');assert.equal(auth.actor,'local_user');assert.equal(done.actor,'paypal_sandbox');assert.equal(done.outcome,'confirmed_created');
  const refresh=()=>h.request(url+`/invoices/${invoiceId}/refresh`,{});
  assert.equal((await refresh()).status,200);assert.equal((await refresh()).status,200);
  current=(await h.request(url)).body.project;
  assert.equal(current.milestones[0].invoices[0].statusHistory.length,1,'repeated same status must not create duplicate transitions');
  assert.equal(current.decisionHistory.filter(e=>e.type==='invoice_status_verified').length,2,'each verified request is a genuine read-back');
  assert.equal(current.decisionHistory.filter(e=>e.type==='invoice_status_verified').every(e=>e.changed===false),true);
  const previous=current.milestones[0].invoices[0].lastVerifiedAt;
  failRefresh=true;assert.equal((await refresh()).status,502);
  current=(await h.request(url)).body.project;
  assert.equal(current.milestones[0].invoices[0].lastVerifiedAt,previous);
  assert.equal(current.milestones[0].invoices[0].status,'DRAFT');
  assert.ok(current.decisionHistory.some(e=>e.type==='invoice_refresh_failed'&&e.outcome==='failed'));
  failRefresh=false;status='PAID';assert.equal((await refresh()).status,200);
  current=(await h.request(url)).body.project;
  assert.equal(current.milestones[0].invoices[0].status,'PAID');
  assert.equal(current.decisionHistory.at(-1).changed,true);
  assert.equal(current.decisionHistory.at(-1).actor,'paypal_sandbox');
  assert.ok(safeAuditMarkdown(current).includes('PayPal Sandbox status read back'));
  assert.equal(current.decisionHistory.some(e=>JSON.stringify(e).includes('synthetic@example.test')),false,'audit events omit recipient');
 }finally{await h.close();}
});
test('v1.8.5 creation uncertainty is not recorded as confirmed invoice and does not allow resubmission',async()=>{
 let created=0;const h=await harness(extract,(req,res,json)=>{
 if(req.url==='/v1/oauth2/token')return json(res,{access_token:'mock'});
 if(req.method==='POST'){created++;return json(res,{},503);}return json(res,{},503);
 });try{
 const p=await save(h,true),url=`/api/projects/${p.id}`;
 await h.request(url+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});
 const payload={milestoneIndex:0,confirmed:true,agreementVersionId:p.agreementVersionId,recipientEmail:'synthetic@example.test'};
 assert.equal((await h.request(url+'/drafts',payload)).status,502);
 const current=(await h.request(url)).body.project;
 assert.equal(current.milestones[0].readiness.code,'uncertain');
 assert.ok(current.decisionHistory.some(e=>e.type==='draft_creation_uncertain'));
 assert.equal(current.decisionHistory.some(e=>e.type==='draft_created'),false);
 assert.equal((await h.request(url+'/drafts',payload)).status,400);assert.equal(created,1);
 }finally{await h.close();}
});
