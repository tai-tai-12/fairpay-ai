/** Local isolated providers only. These tests MUST NOT use real PayPal credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
const source='Milestone 1: Synthetic fixed report fee USD 500 after actual client acceptance.';
const extract=()=>({project_summary:'Synthetic fault test',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'500',trigger:'client acceptance',source_excerpt:source}]});
const buyer='synthetic-buyer@example.test';
async function prepared(h){
 let r=await h.request('/api/analyze',{contractText:source});assert.equal(r.status,200,JSON.stringify(r.body));
 r=await h.request('/api/projects',{analysisId:r.body.analysisId,name:'Fault isolation test',persistEvidence:true});assert.equal(r.status,201,JSON.stringify(r.body));
 const p=r.body.project,base=`/api/projects/${p.id}`;
 r=await h.request(base+'/receivable',{confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Synthetic exact accounting review'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,currency:'USD',amount:m.amount,humanVerified:true,reference:m.source_excerpt})),credits:[]});assert.equal(r.status,200,JSON.stringify(r.body));
 const revision=r.body.project.receivableLedger.id;
 r=await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});assert.equal(r.status,200);
 return {base,input:{milestoneIndex:0,recipientEmail:buyer,confirmed:true,agreementVersionId:p.agreementVersionId,ledgerRevisionId:revision,authorizedAmount:'500.00',netAmountConfirmed:true}};
}
test('TRUST85-09 twenty simultaneous draft clicks create at most one provider POST with same version',async()=>{
 let writes=0;let seenRequestId='';
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'synthetic-token'});
  if(req.method==='POST') {writes++;seenRequestId=req.headers['paypal-request-id'];await new Promise(r=>setTimeout(r,65));return json(res,{id:'INV2-STRESS-12345678'},201);}
  return json(res,{id:'INV2-STRESS-12345678',status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:buyer}}]});
 });
 try{
  const {base,input}=await prepared(h);
  const responses=await Promise.all(Array.from({length:20},()=>h.request(base+'/drafts',input)));
  assert.equal(responses.filter(r=>r.status===201).length,1,JSON.stringify(responses.map(r=>r.status)));
  assert.equal(responses.filter(r=>r.status===400).length,19);
  assert.equal(writes,1);
  assert.match(seenRequestId,/^[a-f0-9-]{36}$/i);
  const p=(await h.request(base)).body.project;
  assert.equal(p.milestones[0].invoices.length,1);
 }finally{await h.close();}
});
test('TRUST85-10 ambiguous provider write is locked and never silently retried',async()=>{
 let writes=0;
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'synthetic-token'});
  if(req.method==='POST'){writes++;req.socket.destroy();return;}
  return json(res,{});
 });
 try{
  const {base,input}=await prepared(h);
  const first=await h.request(base+'/drafts',input);assert.ok(first.status>=400);
  const project=(await h.request(base)).body.project;
  assert.equal(project.milestones[0].creationState,'uncertain');
  const retry=await h.request(base+'/drafts',input);assert.equal(retry.status,400);assert.equal(writes,1);
 }finally{await h.close();}
});
test('TRUST85-11 incorrect external recipient is UNKNOWN and replay never creates a second draft',async()=>{
 let writes=0;
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'synthetic-token'});
  if(req.method==='POST'){writes++;return json(res,{id:'INV2-FAULT-12345678'},201);}
  return json(res,{id:'INV2-FAULT-12345678',status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:'incorrect@example.test'}}]});
 });
 try{
  const {base,input}=await prepared(h);
  let r=await h.request(base+'/drafts',input);assert.equal(r.status,201);assert.equal(r.body.project.milestones[0].invoices[0].status,'UNKNOWN');
  r=await h.request(base+'/drafts',input);assert.equal(r.status,400);assert.equal(writes,1);
 }finally{await h.close();}
});
