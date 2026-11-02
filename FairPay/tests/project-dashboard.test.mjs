import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from '../project-store.mjs';
import {createProject,stateOf,summarize,validateDraft} from '../project-model.mjs';

const agreement=`Project: Website redesign for Acme Bakery.\nMilestone 1: Discovery and wireframes — USD 500, billable once the client approves the wireframes.\nMilestone 2: Final website handoff — USD 800, billable after the final files are delivered and accepted.\nPayment is due upon receipt of each invoice.`;
const parsed={project_summary:'Acme Bakery website redesign',currency_code:'USD',warnings:[],milestones:[
 {title:'Discovery and wireframes',amount:'500',trigger:'client approval',source_excerpt:'Discovery and wireframes — USD 500, billable once the client approves the wireframes.'},
 {title:'Final website handoff',amount:'800',trigger:'file delivery and acceptance',source_excerpt:'Final website handoff — USD 800, billable after the final files are delivered and accepted.'}
]};
function sampleAnalysis(){return {summary:'Acme Bakery',currency:'USD',milestones:[
 {title:'Discovery and wireframes',amount:'500.00',trigger:'client approval',source_excerpt:parsed.milestones[0].source_excerpt,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]},
 {title:'Final website handoff',amount:'800.00',trigger:'acceptance',source_excerpt:parsed.milestones[1].source_excerpt,evidence_matched:true,amount_verification:'verified',financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}]};}
const sameEmail='sb-buyer@personal.example.com';
const port=async()=>{const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;};
const startServer=async(port,env)=>{const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,...env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test'},stdio:'pipe'});
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ready=true;break;}}catch{}await delay(50);}if(!ready)throw new Error('Failed starting application server');return child;};
const request=async(port,url,body=null)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,body===null?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};

test('project model distinguishes ready, approval pending, draft and paid; no artificial paid amounts',()=>{
 const p=createProject(sampleAnalysis(),'Acme Bakery');
 assert.equal(stateOf(p.milestones[0]).code,'pending');
 assert.equal(summarize(p).paidCents,0);
 p.milestones[0].approvalStatus='approved';
 assert.equal(stateOf(p.milestones[0]).code,'ready');
 assert.equal(summarize(p).readyToDraftCents,50000);
 assert.throws(()=>validateDraft(p,1,sameEmail,true),/Awaiting client approval/);
 p.milestones[0].invoices.push({status:'DRAFT',invoiceId:'INV2-ABCDE-12345'});
 assert.equal(summarize(p).paidCents,0);
 assert.equal(stateOf(p.milestones[0]).code,'draft');
 Object.assign(p.milestones[0].invoices[0],{status:'PAID',amount:'500.00',total:{currency:'USD',value:'500.00'},dueAmount:{currency:'USD',value:'0.00'},lastVerifiedAt:'2026-10-15T12:00:00.000Z'});
 assert.equal(summarize(p).paidCents,50000);
 assert.equal(stateOf(p.milestones[0]).code,'paid');
});
test('local project store survives restart and never saves raw contract or credentials',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fairpay-store-test-'));
 try{
  const store=new ProjectStore(dir);await store.initialize();
  const p=await store.add(sampleAnalysis(),'Acme Bakery');
  await store.update(p.id,record=>{record.milestones[0].approvalStatus='approved';});
  const reboot=new ProjectStore(dir);await reboot.initialize();
  assert.equal(reboot.get(p.id).milestones[0].approvalStatus,'approved');
  const content=await readFile(path.join(dir,'.local-data','projects.json'),'utf8');
  assert.ok(!content.includes('OPENAI_API_KEY'));
  assert.ok(!content.includes('Client and designer agree on two milestones'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('project API: saved milestones, approval gate, real mocked PayPal status, refresh and duplicate protection',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fairpay-dashboard-e2e-'));
 const appPort=await port(),ollamaPort=await port(),paypalPort=await port();
 let created=0,status='DRAFT';
 const ollama=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/tags'){res.end(JSON.stringify({models:[{name:'qwen3:4b-instruct'}]}));return;}
  if(req.url==='/api/chat'){res.end(JSON.stringify({message:{content:JSON.stringify(parsed)}}));return;}
  res.writeHead(404);res.end('{}');
 });
 const paypal=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/v1/oauth2/token'){res.end(JSON.stringify({access_token:'test-token'}));return;}
  if(req.url==='/v2/invoicing/invoices'&&req.method==='POST'){
   created++; res.statusCode=201;res.end(JSON.stringify({id:'INV2-EXAMPLE-12345678'}));return;
  }
  if(req.url==='/v2/invoicing/invoices/INV2-EXAMPLE-12345678'){
   res.end(JSON.stringify({id:'INV2-EXAMPLE-12345678',status,amount:{currency_code:'USD',value:'500.00'},due_amount:{currency_code:'USD',value:status==='PAID'?'0.00':'500.00'}}));return;
  }
  res.statusCode=404;res.end('{}');
 });
 ollama.listen(ollamaPort,'127.0.0.1');paypal.listen(paypalPort,'127.0.0.1');
 await Promise.all([once(ollama,'listening'),once(paypal,'listening')]);
 const env={FAIRPAY_TEST_DATA_ROOT:dir,MOCK_PAYPAL_BASE:`http://127.0.0.1:${paypalPort}`,OLLAMA_PORT:String(ollamaPort),AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b-instruct',PAYPAL_CLIENT_ID:'test-id',PAYPAL_CLIENT_SECRET:'test-secret'};
 let child;
 try{
  child=await startServer(appPort,env);
  const a=await request(appPort,'/api/analyze',{contractText:agreement});assert.equal(a.status,200);
  const save=await request(appPort,'/api/projects',{analysisId:a.body.analysisId,name:'Acme Bakery'});assert.equal(save.status,201);
  const id=save.body.project.id;
  const d={milestoneIndex:0,recipientEmail:sameEmail,confirmed:true};
  let r=await request(appPort,`/api/projects/${id}/drafts`,d);
  assert.equal(r.status,400);assert.match(r.body.error,/approval/i);
  assert.equal(created,0);
  r=await request(appPort,`/api/projects/${id}/milestones/0/approval`,{status:'approved'});assert.equal(r.status,200);
  r=await request(appPort,`/api/projects/${id}/drafts`,{...d,confirmed:false});assert.equal(r.status,400);
  r=await request(appPort,`/api/projects/${id}/drafts`,d);
  assert.equal(r.status,201);assert.equal(r.body.status,'DRAFT');assert.equal(created,1);
  r=await request(appPort,`/api/projects/${id}/drafts`,d);
  assert.equal(r.status,400);assert.equal(created,1);
  r=await request(appPort,'/api/projects');
  assert.equal(r.body.projects[0].summary.paidCents,0);
  assert.equal(r.body.projects[0].summary.draftedCents,50000);
  status='PAID';
  r=await request(appPort,`/api/projects/${id}/invoices/INV2-EXAMPLE-12345678/refresh`,{});
  assert.equal(r.status,200);assert.equal(r.body.project.summary.paidCents,50000);
  child.kill(); await once(child,'exit');child=null;
  child=await startServer(appPort,env);
  r=await request(appPort,`/api/projects/${id}`);
  assert.equal(r.status,200);assert.equal(r.body.project.milestones[0].invoices[0].status,'PAID');
 }finally{
  if(child){child.kill();await once(child,'exit');}
  await Promise.all([new Promise(r=>ollama.close(r)),new Promise(r=>paypal.close(r))]);
  await rm(dir,{recursive:true,force:true});
 }
});
