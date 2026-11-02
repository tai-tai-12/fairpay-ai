import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ProjectStore} from '../project-store.mjs';
import {createProject,publicProject} from '../project-model.mjs';
import {nextActions,briefingFacts} from '../action-engine.mjs';
const analysis={summary:'Website redesign for Acme Bakery',currency:'USD',milestones:[
  {title:'Wireframes',amount:'500.00',trigger:'approved',source_excerpt:'Wireframes USD 500',amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[],evidence_matched:true},
  {title:'Handoff',amount:'800.00',trigger:'accepted',source_excerpt:'Handoff USD 800',amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[],evidence_matched:true}
]};

test('v1 safety: action plan never mistakes draft for payment, uses deterministic priority',()=>{
  const p=createProject(analysis,'Acme Bakery');
  let act=nextActions(publicProject(p));
  assert.deepEqual(act.map(a=>a.code),['CONFIRM_ACCEPTANCE','CONFIRM_ACCEPTANCE']);
  p.milestones[0].approvalStatus='approved';
  act=nextActions(publicProject(p));
  assert.deepEqual(act.map(a=>a.code),['PREPARE_DRAFT','CONFIRM_ACCEPTANCE']);
  p.milestones[0].invoices.push({invoiceId:'INV2-ABCDEF-123',status:'DRAFT'});
  act=nextActions(publicProject(p));
  assert.equal(act[0].code,'REVIEW_DRAFT');
  assert.equal(briefingFacts(publicProject(p)).confirmedPaidUsd,'0.00');
  Object.assign(p.milestones[0].invoices[0],{status:'PAID',amount:'500.00',total:{currency:'USD',value:'500.00'},dueAmount:{currency:'USD',value:'0.00'},lastVerifiedAt:'2026-10-15T12:00:00.000Z'});
  assert.equal(nextActions(publicProject(p)).find(a=>a.milestoneIndex===0).code,'RECORD_PAID');
  assert.equal(briefingFacts(publicProject(p)).confirmedPaidUsd,'500.00');
});
test('v1 project archive is reversible; preserves invoice ID, approval and local persistence',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fairpay-v1-archive-'));
  try{
    const store=new ProjectStore(dir);await store.initialize();
    const p=await store.add(analysis,'Old sample project');
    await store.update(p.id,item=>{item.milestones[0].approvalStatus='approved';item.milestones[0].invoices.push({invoiceId:'INV2-TEST-12345678',status:'DRAFT'});});
    await store.update(p.id,item=>{item.archivedAt=new Date().toISOString();});
    const reboot=new ProjectStore(dir);await reboot.initialize();
    const saved=reboot.get(p.id);
    assert.ok(saved.archivedAt);
    assert.equal(saved.milestones[0].invoices[0].invoiceId,'INV2-TEST-12345678');
    assert.equal(saved.milestones[0].approvalStatus,'approved');
    await reboot.update(p.id,item=>{item.archivedAt=null;item.name='Acme Bakery — Website redesign';});
    assert.equal(reboot.get(p.id).archivedAt,null);
    assert.equal(reboot.get(p.id).name,'Acme Bakery — Website redesign');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('v1 repeated Save does not create indistinguishable active duplicates',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fairpay-v1-dedupe-'));
  try{
    const store=new ProjectStore(dir);await store.initialize();
    const first=await store.add(analysis,'Demo 1');
    await assert.rejects(store.add(analysis,'Demo 2'),e=>e.code==='DUPLICATE_PROJECT'&&e.existingProjectId===first.id);
    assert.equal(store.list().length,1);
    await store.update(first.id,item=>{item.archivedAt=new Date().toISOString();});
    assert.ok((await store.add(analysis,'New active project')).id!==first.id);
  }finally{await rm(dir,{recursive:true,force:true});}
});
