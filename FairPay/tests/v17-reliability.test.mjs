import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {harness} from './support/server.mjs';
test('v1.7 frozen original benchmarks/tests and new predeclared challenge remain unchanged',async()=>{
 const manifest=JSON.parse(await fs.readFile('tests/support/frozen-baseline-hashes.json','utf8'));
 for(const f of manifest.files.filter(f=>/^(evaluation|tests|handoff\/reference_baselines)\//.test(f.path))){assert.equal(createHash('sha256').update(await fs.readFile(f.path)).digest('hex'),f.sha256,f.path);}
 const bytes=await fs.readFile('evaluation/challenge-v17.json');assert.equal(createHash('sha256').update(bytes).digest('hex'),(await fs.readFile('evaluation/challenge-v17.sha256','utf8')).trim());
 assert.equal(new Set(JSON.parse(bytes).cases.map(c=>c.id)).size,6);
});
test('v1.7 invalid input and forged financial requests fail before any provider write',async()=>{
 let modelCalls=0;const h=await harness(()=>{modelCalls++;return {};});
 try{
  for(const contractText of ['', 'short', 'x'.repeat(12001), 100, null])assert.equal((await h.request('/api/analyze',{contractText})).status,400);
  assert.equal((await h.request('/api/projects',{analysisId:'forged',persistEvidence:true})).status,400);
  assert.equal((await h.request('/api/invoices',{analysisId:'forged',milestoneIndex:0,confirmed:true,clientApproved:true,amount:'999.00',status:'PAID'})).status,400);
  assert.equal(modelCalls,0);assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});
