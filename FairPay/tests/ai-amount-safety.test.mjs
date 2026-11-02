import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
const sample='Project: Website redesign for Acme Bakery.\n1) Discovery and wireframes — USD 500, billable once the client approves the wireframes.\n2) Final website handoff — USD 800, billable after the final files are delivered and accepted.';
test('actual AI error USD 80 is repaired using literal USD 800 evidence',async()=>{
 const mockPort=await freePort(),appPort=await freePort();
 const mock=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));return;}
  if(req.url==='/api/chat'){
   const payload={project_summary:'Website redesign',currency_code:'USD',warnings:['AI sees amount may be 800'],milestones:[
    {title:'Discovery and wireframes',amount:'500',trigger:'approval',source_excerpt:'Discovery and wireframes — USD 500, billable once the client approves the wireframes.'},
    {title:'Final website handoff',amount:'80',trigger:'acceptance',source_excerpt:'Final website handoff — USD 800, billable after the final files are delivered and accepted.'}
   ]};
   res.end(JSON.stringify({message:{content:JSON.stringify(payload)}}));return;
  }
  res.writeHead(404).end('{}');
 });
 mock.listen(mockPort,'127.0.0.1');await once(mock,'listening');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(appPort),OLLAMA_PORT:String(mockPort),AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',HOST:'127.0.0.1',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:''},stdio:'ignore'});
 try{
  let running=false;
  for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${appPort}/api/health`);if(r.ok){running=true;break;}}catch{}await delay(50);}
  assert.ok(running);
  const res=await fetch(`http://127.0.0.1:${appPort}/api/analyze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractText:sample})});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.deepEqual(body.milestones.map(m=>m.amount),['500.00','800.00']);
  assert.deepEqual(body.milestones.map(m=>m.amount_verification),['verified','corrected']);
  assert.ok(body.warnings.some(w=>w.includes('AI amount USD 80.00')));
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
