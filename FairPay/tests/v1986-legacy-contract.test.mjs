/** New current-contract regression; historical expectations remain untouched. Loopback mocks only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/server.mjs';
import {reconcileSyntheticGross,grossAuthorization} from './support/receivable-fixture.mjs';
const text='Synthetic controlled review. Milestone 1: Deliver report for USD 620 after actual client acceptance.';
const extract=()=>({project_summary:'Synthetic',currency_code:'USD',milestones:[{title:'Report',amount:'620',trigger:'acceptance',source_excerpt:text}],warnings:[]});
const buyer='review@example.test',id='INV2-CONTROLLED-12345678';
const detail=(status='DRAFT')=>({id,status,amount:{currency_code:'USD',value:'620.00'},due_amount:{currency_code:'USD',value:status==='PAID'?'0.00':'620.00'},primary_recipients:[{billing_info:{email_address:buyer}}]});
async function saved(h){const a=await h.request('/api/analyze',{contractText:text});assert.equal(a.status,200);const r=await h.request('/api/projects',{analysisId:a.body.analysisId,name:"Synthetic controlled review",persistEvidence:true});assert.equal(r.status,201);return r.body.project;}
test('CONTROL86-01 legacy hung precondition now has explicit zero-write rejection proof', {timeout:8000}, async()=>{
 let writes=0;const h=await harness(extract,(req,res,json)=>{if(req.method==='POST')writes++;return json(res,{},500);});
 try{
  const p=await saved(h),base=`/api/projects/${p.id}`;
  assert.equal((await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId})).status,200);
  const r=await h.request(base+'/drafts',{milestoneIndex:0,confirmed:true,agreementVersionId:p.agreementVersionId,recipientEmail:buyer});
  assert.equal(r.status,400);assert.match(r.body.error,/reconciliation|financial/i);assert.equal(writes,0);assert.equal(h.paypalCalls(),0);
  assert.equal((await h.request('/api/invoices',{confirmed:true})).status,410);assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});
test('CONTROL86-02 complete current authorization preserves serialized readback and locks replay', {timeout:8000}, async()=>{
 let writes=0,reads=0,mode='normal',active=0,maxActive=0;
 const h=await harness(extract,async(req,res,json)=>{
  if(req.url.endsWith('/token'))return json(res,{access_token:'mock'});
  if(req.method==='POST'){writes++;return json(res,{id},201);}
  active++;maxActive=Math.max(active,maxActive);const n=++reads;
  await new Promise(r=>setTimeout(r,n===2?80:5));active--;
  return json(res,mode==='missing'?{id,status:'PAID'}:detail(n>=3?'PAID':'DRAFT'));
 });
 try{
  const p=await saved(h),base=`/api/projects/${p.id}`,revision=await reconcileSyntheticGross(h,p);
  assert.equal((await h.request(base+'/milestones/0/approval',{status:'approved',agreementVersionId:p.agreementVersionId})).status,200);
  const body={milestoneIndex:0,recipientEmail:buyer,...grossAuthorization(p,revision)};
  const created=await h.request(base+'/drafts',body);assert.equal(created.status,201);assert.equal(created.body.status,'DRAFT');
  const ref=base+`/invoices/${id}/refresh`;
  const responses=await Promise.all([h.request(ref,{}),h.request(ref,{})]);assert.deepEqual(responses.map(r=>r.status),[200,200]);assert.equal(maxActive,1);assert.equal(writes,1);
  let current=(await h.request(base)).body.project;assert.equal(current.summary.confirmedPaidCents,62000);
  assert.deepEqual(current.milestones[0].invoices[0].statusHistory.map(x=>x.status),['DRAFT','PAID']);
  mode='missing';current=(await h.request(ref,{})).body.project;assert.equal(current.milestones[0].invoices[0].status,'UNKNOWN');assert.equal(current.summary.confirmedPaidCents,0);
  assert.equal((await h.request(base+'/drafts',body)).status,400);assert.equal(writes,1);
  mode='normal';current=(await h.request(ref,{})).body.project;assert.equal(current.milestones[0].invoices[0].status,'PAID');assert.equal(writes,1);
 }finally{await h.close();}
});
