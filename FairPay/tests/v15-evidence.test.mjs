import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {harness} from './support/server.mjs';
import {ProjectStore} from '../project-store.mjs';
const source=amount=>`Project: Synthetic fern study. Milestone 1: Research summary costs USD ${amount}, billable after actual client acceptance.`;
const extract=text=>{if(text.includes('UNAVAILABLE'))throw Error();return {project_summary:'Fern study',currency_code:'USD',warnings:[],milestones:[{title:'Research summary',amount:text.match(/USD (\d+)/)?.[1],source_excerpt:text,trigger:'client acceptance'}]};};
test('v1.5 opt-in versions persist, reject stale authorization, invalidate approvals and preserve canonical ID',async()=>{
 const h=await harness(extract);try{
 const a=await h.request('/api/analyze',{contractText:source(410)});
 const save=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Fern',persistEvidence:true});assert.equal(save.status,201);
 const p=save.body.project,id=p.id,v=p.agreementVersionId,c=p.milestones[0].canonicalId;assert.equal(p.agreementVersions[0].sourceText,source(410));
 assert.equal((await h.request(`/api/projects/${id}/milestones/0/approval`,{status:'approved'})).status,400);
 assert.equal((await h.request(`/api/projects/${id}/milestones/0/approval`,{status:'approved',agreementVersionId:v})).status,200);
 const res=await h.request(`/api/projects/${id}/reanalyze`,{contractText:source(510),persistEvidence:true,agreementVersionId:v});assert.equal(res.status,200);assert.equal(res.body.project.milestones[0].canonicalId,c);assert.equal(res.body.project.milestones[0].approvalStatus,'pending');assert.equal(res.body.project.agreementVersions.length,2);assert.equal(res.body.project.agreementVersions[0].sourceText,source(410));
 assert.equal((await h.request(`/api/projects/${id}/drafts`,{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:v})).status,400);
 assert.equal((await h.request(`/api/projects/${id}/milestones/0/approval`,{status:'approved',agreementVersionId:v})).status,400);
 const current=res.body.project.agreementVersionId;
 assert.equal((await h.request(`/api/projects/${id}/reanalyze`,{contractText:source(610),persistEvidence:true,agreementVersionId:v})).status,409);
 assert.equal((await h.request(`/api/projects/${id}/reanalyze`,{contractText:source(510)+' UNAVAILABLE',persistEvidence:true,agreementVersionId:current})).status,502);
 const failed=await h.request(`/api/projects/${id}`);assert.equal(failed.body.project.milestones[0].readiness.code,'blocked');assert.equal(failed.body.project.agreementVersions.length,2);
 const draft=await h.request(`/api/projects/${id}/clarification`,{milestoneIndex:0});assert.equal(draft.body.noExternalSend,true);assert.match(draft.body.draft,/Source version/);assert.equal(h.paypalCalls(),0);
 const reopened=new ProjectStore(h.root);await reopened.initialize();assert.equal(reopened.get(id).agreementVersions.length,2);assert.ok(reopened.get(id).decisionHistory.some(e=>e.type==='reanalysis_failed'));
 }finally{await h.close();}
});
test('v1.5 non-opted source remains unavailable; reanalysis rejects existing invoice without altering IDs',async()=>{
 const h=await harness(extract,(req,res,json)=>req.url==='/v1/oauth2/token'?json(res,{access_token:'mock'}):json(res,{id:'INV2-SYNTHETIC-12345678',status:'DRAFT'},req.method==='POST'?201:200));try{
 const a=await h.request('/api/analyze',{contractText:source(410)});const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Legacy'});const id=saved.body.project.id;assert.equal(saved.body.project.agreementVersions,undefined);
 assert.equal((await h.request('/api/invoices',{analysisId:a.body.analysisId,milestoneIndex:0,amount:'410.00',title:'Research summary',confirmed:true,clientApproved:true,recipientEmail:'synthetic@example.test'})).status,400);
 await h.request(`/api/projects/${id}/milestones/0/approval`,{status:'approved'});assert.equal((await h.request(`/api/projects/${id}/drafts`,{milestoneIndex:0,confirmed:true,recipientEmail:'synthetic@example.test'})).status,201);
 const calls=h.paypalCalls();assert.equal((await h.request(`/api/projects/${id}/reanalyze`,{contractText:source(510),persistEvidence:true})).status,409);const p=(await h.request(`/api/projects/${id}`)).body.project;assert.equal(p.milestones[0].invoices[0].invoiceId,'INV2-SYNTHETIC-12345678');assert.equal(h.paypalCalls(),calls);
 }finally{await h.close();}
});
test('v1.5 transaction rollback prevents failed persistence from altering approvals in memory',async()=>{
 const h=await harness(extract);try{const store=new ProjectStore(h.root);await store.initialize();const p=await store.add({currency:'USD',milestones:[{title:'Synthetic',amount:null}]},'Rollback');const actual=store.file;store.file=path.join(h.root,'missing','file.json');await assert.rejects(store.update(p.id,p=>p.milestones[0].approvalStatus='approved'));assert.equal(store.get(p.id).milestones[0].approvalStatus,'pending');store.file=actual;assert.equal(JSON.parse(await fs.readFile(actual,'utf8')).projects[0].milestones[0].approvalStatus,'pending');}finally{await h.close();}
});
test('v1.5 reanalysis in flight blocks approvals and drafts; interrupted work recovers fail-closed',async()=>{
 let release,started;const entered=new Promise(r=>started=r),wait=new Promise(r=>release=r);const h=await harness(async text=>{if(text.includes('WAIT')){started();await wait;}return extract(text);});
 try{const a=await h.request('/api/analyze',{contractText:source(410)});const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Concurrent',persistEvidence:true});const p=saved.body.project;
 const pending=h.request(`/api/projects/${p.id}/reanalyze`,{contractText:source(510)+' WAIT',persistEvidence:true,agreementVersionId:p.agreementVersionId});await entered;
 assert.equal((await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved',agreementVersionId:p.agreementVersionId})).status,400);
 assert.equal((await h.request(`/api/projects/${p.id}/drafts`,{confirmed:true,milestoneIndex:0,recipientEmail:'synthetic@example.test',agreementVersionId:p.agreementVersionId})).status,400);
 const reboot=new ProjectStore(h.root);await reboot.initialize();assert.equal(reboot.get(p.id).pendingAnalysis,null);assert.equal(reboot.get(p.id).milestones[0].reanalysisRequired,true);
 release();assert.equal((await pending).status,200);assert.equal(h.paypalCalls(),0);
 }finally{release?.();await h.close();}
});
test('v1.5 A04-style unpunctuated milestone references collapse multiple model interpretations to one blocked item',async()=>{
 const text='Project: Synthetic mark. Milestone 1 was originally priced USD 240. An amendment revised to USD 280; an unsigned memo revised to USD 310, with no stated priority.';
 const h=await harness(()=>({project_summary:'Duplicate',currency_code:'USD',warnings:[],milestones:[{title:'Original mark',amount:'240',source_excerpt:text,trigger:'approval'},{title:'Revised mark',amount:'310',source_excerpt:text,trigger:'approval'}]}));try{const r=await h.request('/api/analyze',{contractText:text});assert.equal(r.status,200);assert.equal(r.body.milestones.length,1);assert.equal(r.body.milestones[0].amount,null);assert.ok(r.body.milestones[0].financialRiskCodes.includes('DUPLICATE_MILESTONE_INTERPRETATION'));assert.equal(h.paypalCalls(),0);}finally{await h.close();}
});
