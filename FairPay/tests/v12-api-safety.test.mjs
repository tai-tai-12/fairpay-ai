import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const freePort=async()=>{const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const json=(res,body)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
const request=async(port,pathname,payload)=>{const response=await fetch(`http://127.0.0.1:${port}${pathname}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return {status:response.status,body:await response.json()};};
test('v1.2 SERVER refuses crafted rate/estimate/optional/deposit invoices even with simulated user approval',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fairpay-v12-e2e-'));
 const appPort=await freePort(),ollamaPort=await freePort(),paypalPort=await freePort();
 const scenarios=[
  ['hourly','Project: Field Lab analysis. Milestone 1: Research task at USD 75 per hour, but the number of payable hours has not been agreed or recorded. No total milestone fee is stated.','Research task at USD 75 per hour','75'],
  ['estimate','Project: Moss prototype. Milestone 1: An early estimate of USD 400 was discussed, but the agreement explicitly says there is no agreed final price.','An early estimate of USD 400','400'],
  ['optional','Project: Newsletter design. Milestone 1: Main design is USD 400, optional rush work may cost USD 100, but the client has not authorized rush work and the billable total is not agreed.','Main design is USD 400','400'],
  ['deposit','Project: Podcast editing. Milestone 1: Final episode costs USD 700, with USD 200 mentioned as a deposit credit. The agreement does not clarify the remaining invoice balance.','Final episode costs USD 700','700']
 ];
 const ai=http.createServer(async(req,res)=>{
  if(req.url==='/api/tags')return json(res,{models:[{name:'qwen3:4b-instruct'}]});
  if(req.url!=='/api/chat'){res.writeHead(404);res.end();return;}
  const chunks=[];for await (const chunk of req)chunks.push(chunk);
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8')).messages?.at(-1)?.content||'';
  const match=scenarios.find(row=>row[1]===input);if(!match)return json(res,{message:{content:JSON.stringify({project_summary:'Safe normal',currency_code:'USD',milestones:[],warnings:[]})}});
  return json(res,{message:{content:JSON.stringify({project_summary:match[0],currency_code:'USD',warnings:[],milestones:[{title:'Milestone 1',amount:match[3],trigger:'client approval',source_excerpt:match[2]}]})}});
 });
 let paypalWriteCount=0;
 const paypal=http.createServer((req,res)=>{if(req.method==='POST'&&req.url?.includes('/v2/invoicing'))paypalWriteCount++;json(res,{access_token:'fake-token'});});
 ai.listen(ollamaPort,'127.0.0.1');paypal.listen(paypalPort,'127.0.0.1');
 await Promise.all([once(ai,'listening'),once(paypal,'listening')]);
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,
   env:{...process.env,NODE_ENV:'test',FAIRPAY_TEST_DATA_ROOT:dir,PORT:String(appPort),HOST:'127.0.0.1',OLLAMA_PORT:String(ollamaPort),AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',MOCK_PAYPAL_BASE:`http://127.0.0.1:${paypalPort}`,PAYPAL_CLIENT_ID:'fake',PAYPAL_CLIENT_SECRET:'fake'},stdio:'pipe'});
 try{
  let ready=false;for(let i=0;i<75;i++){try{const r=await fetch(`http://127.0.0.1:${appPort}/api/health`);if(r.ok){ready=true;break;}}catch{}await delay(45);}
  assert.ok(ready,'server started');
  for(const row of scenarios){
   const analyzed=await request(appPort,'/api/analyze',{contractText:row[1]});
   assert.equal(analyzed.status,200,row[0]);
   assert.equal(analyzed.body.milestones[0].amount,null,row[0]);
   assert.ok(analyzed.body.milestones[0].financialRiskCodes?.length>0,row[0]);
   const added=await request(appPort,'/api/projects',{analysisId:analyzed.body.analysisId,name:row[0]});
   assert.equal(added.status,201,row[0]);
   const id=added.body.project.id;
   await request(appPort,`/api/projects/${id}/milestones/0/approval`,{status:'approved'});
   const drafting=await request(appPort,`/api/projects/${id}/drafts`,{milestoneIndex:0,recipientEmail:'sb-user@personal.example.com',confirmed:true});
   assert.equal(drafting.status,400,row[0]);
   assert.equal(paypalWriteCount,0);
  }
 }finally{
  child.kill();await once(child,'exit');
  await Promise.all([new Promise(r=>ai.close(r)),new Promise(r=>paypal.close(r))]);
  await rm(dir,{recursive:true,force:true});
 }
});
