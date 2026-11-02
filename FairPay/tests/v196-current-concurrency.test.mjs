import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
const quote='Milestone 1: Synthetic report fee USD 500 after client acceptance.';
const extract=()=>({project_summary:'Synthetic report',currency_code:'USD',warnings:[],milestones:[{title:'Report',amount:'500',trigger:'client acceptance',source_excerpt:quote}]});
const recipient='synthetic@example.test';
test('DEV4-RACE1 accepted Sandbox create cannot have approvals rewritten in flight and cannot be repeated',async()=>{
 let release;let signal;let writes=0;
 const started=new Promise(r=>signal=r);
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'local-mock'});
  if(req.method==='POST'){writes++;signal();await new Promise(r=>release=r);return json(res,{id:'INV2-SAFETY-12345678'},201);}
  return json(res,{id:'INV2-SAFETY-12345678',status:'DRAFT',amount:{currency_code:'USD',value:'500.00'},primary_recipients:[{billing_info:{email_address:recipient}}]});
 });
 try{
  let r=await h.request('/api/analyze',{contractText:quote});assert.equal(r.status,200);
  r=await h.request('/api/projects',{analysisId:r.body.analysisId,name:'Synthetic no-credit project',persistEvidence:true});assert.equal(r.status,201);
  const p=r.body.project,base=`/api/projects/${p.id}`;
  r=await h.request(base+'/receivable',{confirmed:true,expectedRevision:null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:{humanVerified:true,reference:'Independent synthetic no-credit review'},gross:p.milestones.map(m=>({milestoneId:m.canonicalId,currency:'USD',amount:m.amount,humanVerified:true,reference:m.source_excerpt})),credits:[]});assert.equal(r.status,200);
  const ledgerRevisionId=r.body.project.receivableLedger.id;
  r=await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId});assert.equal(r.status,200);
  const body={milestoneIndex:0,recipientEmail:recipient,confirmed:true,agreementVersionId:p.agreementVersionId,ledgerRevisionId,authorizedAmount:'500.00',netAmountConfirmed:true};
  const first=h.request(base+'/drafts',body);
  await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(new Error('No provider write was attempted')),5000))]);
  const [revoke,duplicate]=await Promise.all([h.request(base+'/milestones/0/approval',{status:'pending',agreementVersionId:p.agreementVersionId}),h.request(base+'/drafts',body)]);
  assert.equal(revoke.status,400);assert.equal(duplicate.status,400);assert.equal(writes,1);
  release();const created=await first;assert.equal(created.status,201);
  const latest=(await h.request(base)).body.project;
  assert.equal(latest.milestones[0].invoices.length,1);
  assert.equal(latest.milestones[0].invoices[0].authorization.amountMinor,50000);
  assert.equal(latest.milestones[0].approvalStatus,'approved');
 }finally{if(release)release();await h.close();}
});
