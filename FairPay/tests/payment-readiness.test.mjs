import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {assessAmendment} from '../lib.mjs';
const amendment=`Project: Landing page design for Acme Bakery.\n\nOriginal agreement:\nMilestone 1: Website mockup delivery — USD 500, billable after client approval.\n\nContract amendment:\nThe fee for Milestone 1 has been revised to USD 550. This new amount supersedes the original USD 500 fee.\n\nPayment is due upon receipt of the invoice after client approval.`;
const missing=`Project: Logo design for Harbor Studio.\nMilestone 1: Final logo delivery, billable after client approval.\nThe client and designer have not agreed on the price yet. The final amount will be negotiated after delivery. No fixed fee or project budget has been specified.`;
const fakeAmendment={project_summary:'Landing page design for Acme Bakery',currency_code:'USD',warnings:['The amendment supersedes the original USD 500 with USD 550.'],milestones:[{title:'Website mockup delivery',amount:'550',trigger:'client approval',source_excerpt:'The fee for Milestone 1 has been revised to USD 550. This new amount supersedes the original USD 500 fee.'}]};
const fakeMissing={project_summary:'Logo design',currency_code:'USD',warnings:['Price has not been set'],milestones:[{title:'Final logo delivery',amount:null,trigger:'client approval',source_excerpt:'The client and designer have not agreed on the price yet.'}]};
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function post(p,obj){const r=await fetch(`http://127.0.0.1:${p}/api/${obj.action||'invoices'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj.body)});return {status:r.status,body:await r.json()};}
test('conservative amendment assessment recognizes explicit revised fee and does not silently choose expired value',()=>{
 const x=assessAmendment(amendment,0,1);
 assert.equal(x.status,'amendment_review');
 assert.equal(x.amount,'550.00');
});
test('missing, amendment, and forged requests blocked at server-side invoice gate',async()=>{
 const mockPort=await port(), appPort=await port();
 const mock=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));return;}
  if(req.url==='/api/chat'){
   let txt='';for await(const c of req)txt+=c;
   const messages=JSON.parse(txt).messages;
   const payload=String(messages.at(-1).content).includes('Harbor Studio')?fakeMissing:fakeAmendment;
   res.end(JSON.stringify({message:{content:JSON.stringify(payload)}}));return;
  }
  res.writeHead(404);res.end('{}');
 });
 mock.listen(mockPort,'127.0.0.1');await once(mock,'listening');
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(appPort),OLLAMA_PORT:String(mockPort),AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',HOST:'127.0.0.1',PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:''},stdio:'ignore'});
 try{
  let ok=false;for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${appPort}/api/health`)).ok){ok=true;break;}}catch{}await delay(50);}assert.ok(ok);
  const a=await post(appPort,{action:'analyze',body:{contractText:amendment}});
  assert.equal(a.status,200);
  assert.equal(a.body.milestones[0].amount,'550.00');
  assert.equal(a.body.milestones[0].amount_verification,'amendment_review');
  const base={analysisId:a.body.analysisId,milestoneIndex:0,amount:'550.00',title:'Website mockup delivery',recipientEmail:'sandbox-buyer@example.com',confirmed:true,clientApproved:true,amendmentConfirmed:true};
  let r=await post(appPort,{body:{...base,amount:'500.00'}});
  assert.equal(r.status,400);assert.match(r.body.error,/differ/);
  r=await post(appPort,{body:{...base,clientApproved:false}});
  assert.equal(r.status,400);assert.match(r.body.error,/approval/i);
  r=await post(appPort,{body:{...base,amendmentConfirmed:false}});
  assert.equal(r.status,400);assert.match(r.body.error,/amendment/);
  r=await post(appPort,{body:{...base,analysisId:'fake'}});
  assert.equal(r.status,400);assert.match(r.body.error,/expired or missing/i);
  const b=await post(appPort,{action:'analyze',body:{contractText:missing}});
  assert.equal(b.status,200);assert.equal(b.body.milestones[0].amount,null);
  r=await post(appPort,{body:{...base,analysisId:b.body.analysisId,amount:'500.00',title:'Final logo delivery'}});
  assert.equal(r.status,400);assert.match(r.body.error,/cannot be verified/);
 }finally{child.kill();await new Promise(r=>mock.close(r));}
});
