import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

const sample = `Project: Website redesign for Acme Bakery.\nClient and designer agree on two milestones:\n1) Discovery and wireframes — USD 500, billable once the client approves the wireframes.\n2) Final website handoff — USD 800, billable after the final files are delivered and accepted.\nPayment is due upon receipt of each invoice.`;
async function freePort(){
 const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');
 const port=s.address().port;await new Promise(r=>s.close(r));return port;
}
async function listen(server,port){server.listen(port,'127.0.0.1');await once(server,'listening');}
const fakeResult = {
 project_summary:'Bakery website redesign',currency_code:'USD',warnings:[],milestones:[
 {title:'Discovery and wireframes',amount:'500',trigger:'client approves the wireframes',source_excerpt:'Discovery and wireframes — USD 500, billable once the client approves the wireframes.'},
 {title:'Final website handoff',amount:'800',trigger:'final files delivered and accepted',source_excerpt:'Final website handoff — USD 800, billable after the final files are delivered and accepted.'}
 ]
};

test('fresh setup integrates browser backend with local Ollama-like API, without paid services',async()=>{
 const mockPort=await freePort(),appPort=await freePort();
 let receivedChat=false;
 const mock=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));return;}
  if(req.url==='/api/chat'){
   let body='';for await(const chunk of req)body+=chunk;
   const parsed=JSON.parse(body);
   assert.equal(parsed.model,'qwen3:4b-instruct');
   assert.equal(parsed.stream,false);
   assert.ok(parsed.format?.properties?.milestones);
   receivedChat=true;
   res.end(JSON.stringify({message:{content:JSON.stringify(fakeResult)}}));return;
  }
  res.writeHead(404);res.end('{}');
 });
 await listen(mock,mockPort);
 const child=spawn(process.execPath,['server.mjs'],{
  cwd:new URL('..',import.meta.url).pathname,
  env:{...process.env,PORT:String(appPort),OLLAMA_PORT:String(mockPort),AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',HOST:'127.0.0.1',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:''},
  stdio:'ignore'
 });
 try{
  let ok=false;
  for(let i=0;i<80;i++){
   if(child.exitCode!==null)break;
   try{const r=await fetch(`http://127.0.0.1:${appPort}/api/health`);if(r.ok){ok=true;break;}}catch{}
   await delay(50);
  }
  assert.ok(ok,'local app server launched');
  const health=await (await fetch(`http://127.0.0.1:${appPort}/api/health`)).json();
  assert.equal(health.aiProvider,'ollama');
  assert.equal(health.ollamaReachable,true);
  assert.equal(health.modelInstalled,true);
  assert.equal(health.paypalConfigured,false);
  const page=await fetch(`http://127.0.0.1:${appPort}/`);
  assert.equal(page.status,200);
  assert.match(await page.text(),/FairPay AI/);
  const result=await fetch(`http://127.0.0.1:${appPort}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractText:sample})});
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.milestones.length,2);
  assert.deepEqual(body.milestones.map(m=>m.amount),['500.00','800.00']);
  assert.deepEqual(body.milestones.map(m=>m.amount_verification),['verified','verified']);
  assert.ok(body.milestones.every(m=>m.evidence_matched));
  assert.ok(receivedChat);
  const noApproval=await fetch(`http://127.0.0.1:${appPort}/api/invoices`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:false,amount:'1',recipientEmail:'buyer@example.com',title:'test'})});
  assert.equal(noApproval.status,400);
 }finally{
  child.kill('SIGTERM');
  await new Promise(resolve=>mock.close(resolve));
 }
});
