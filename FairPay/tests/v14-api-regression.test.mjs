import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness} from './support/server.mjs';
const dataset=JSON.parse(fs.readFileSync(new URL('../evaluation/stress-v13.json',import.meta.url),'utf8')).cases;
test('v1.4 live-discovered risks block both invoice APIs before ANY PayPal request',async()=>{
 const h=await harness(text=>({project_summary:'Synthetic regression',currency_code:'USD',warnings:[],milestones:[{title:'Work',amount:'530',trigger:'accepted',source_excerpt:text}]}));
 try{for(const id of ['S13-M02','S13-C01','S13-C02']){
 const c=dataset.find(x=>x.id===id);const a=await h.request('/api/analyze',{contractText:c.agreement});assert.equal(a.status,200);assert.equal(a.body.milestones[0].amount,null);
 const p=await h.request('/api/projects',{analysisId:a.body.analysisId,name:id});assert.equal(p.status,201);
 await h.request(`/api/projects/${p.body.project.id}/milestones/0/approval`,{status:'approved'});
 assert.equal((await h.request(`/api/projects/${p.body.project.id}/drafts`,{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true})).status,400);
 assert.equal((await h.request('/api/invoices',{analysisId:a.body.analysisId,milestoneIndex:0,title:'Work',amount:'530.00',recipientEmail:'synthetic@example.test',confirmed:true,clientApproved:true})).status,400);
 }assert.equal(h.paypalCalls(),0);}finally{await h.close();}
});
