import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from '../project-store.mjs';
const port=async()=>{const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const sample={summary:'Do not transmit Client Address or original agreement',currency:'USD',milestones:[{title:'Wireframes',amount:'500.00',trigger:'approved',source_excerpt:'Secret company information should NOT be sent',amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[],evidence_matched:true}]};
test('v1 API: local archive/rename, dedupe 409, action plans, privacy-aware AI briefing',async()=>{
  const tmp=await mkdtemp(path.join(tmpdir(),'fairpay-v1-api-'));
  const appPort=await port(), ollamaPort=await port();
  let seenBody='';
  const ollama=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/chat'){
      let raw='';for await(const chunk of req)raw+=chunk;
      seenBody=raw;res.end(JSON.stringify({message:{content:JSON.stringify({note:'One milestone requires human review before a sandbox draft can be made.'})}}));return;
    }
    if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));return;}
    res.statusCode=404;res.end('{}');
  });
  ollama.listen(ollamaPort,'127.0.0.1');await once(ollama,'listening');
  const store=new ProjectStore(tmp);await store.initialize();
  const project=await store.add(sample,'Secret client demo');
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(appPort),HOST:'127.0.0.1',NODE_ENV:'test',FAIRPAY_TEST_DATA_ROOT:tmp,OLLAMA_PORT:String(ollamaPort),OLLAMA_MODEL:'qwen3:4b-instruct',AI_PROVIDER:'ollama'},stdio:'pipe'});
  const request=async(url,body)=>{const res=await fetch(`http://127.0.0.1:${appPort}${url}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:res.status,data:await res.json()};};
  try{
    let ok=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${appPort}/api/health`);if(r.ok){ok=true;break;}}catch{}await delay(50);}assert.ok(ok);
    let r=await request(`/api/projects/${project.id}/actions`);assert.equal(r.status,200);assert.equal(r.data.actions[0].code,'CONFIRM_ACCEPTANCE');
    r=await request(`/api/projects/${project.id}/briefing`,{});assert.equal(r.status,200);assert.equal(r.data.noFinancialWrite,true);
    assert.ok(seenBody.includes('milestoneCount'));assert.ok(!seenBody.includes('Secret client demo'));assert.ok(!seenBody.includes('Secret company information'));
    r=await request(`/api/projects/${project.id}/rename`,{name:'Acme Bakery — Website redesign'});assert.equal(r.status,200);
    r=await request(`/api/projects/${project.id}/archive`,{});assert.equal(r.status,200);assert.ok(r.data.project.archivedAt);
    r=await request(`/api/projects/${project.id}/milestones/0/approval`,{status:'approved'});assert.equal(r.status,400);
    r=await request(`/api/projects/${project.id}/restore`,{});assert.equal(r.status,200);assert.equal(r.data.project.archivedAt,null);
    r=await request('/api/projects');assert.equal(r.data.projects[0].name,'Acme Bakery — Website redesign');
    const record=store.get(project.id);assert.equal(record.milestones[0].invoices.length,0);
  }finally{
    child.kill();await once(child,'exit');await new Promise(r=>ollama.close(r));await rm(tmp,{recursive:true,force:true});
  }
});
