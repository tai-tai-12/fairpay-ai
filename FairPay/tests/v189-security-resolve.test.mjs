import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import http from 'node:http';
import {harness} from './support/server.mjs';
import {requestBoundary} from '../request-security.mjs';
import {compareAgreementVersions,termStatus} from '../public/resolve-comparison.mjs';

const source=amount=>`Project: Synthetic maple study. Milestone 1: Research summary costs USD ${amount}, billable only after actual client acceptance.`;
const extractor=text=>({project_summary:'Maple study',currency_code:'USD',warnings:[],milestones:[{title:'Research summary',amount:text.match(/USD (\d+)/)?.[1]||null,trigger:'client acceptance',source_excerpt:text}]});

test('v1.8.9 request boundary rejects poisoned hosts, foreign origins, spoofed fetch sites and simple POST types',()=>{
 const request=(headers,method='POST')=>({headers,method});const host='127.0.0.1:3118';
 assert.equal(requestBoundary(request({host,'content-type':'application/json'}),3118),null);
 assert.equal(requestBoundary(request({host,origin:'http://127.0.0.1:3118','content-type':'application/json; charset=utf-8','sec-fetch-site':'same-origin'}),3118),null);
 for(const h of [{host:'attacker.test:3118','content-type':'application/json'}, {host,origin:'https://attacker.test','content-type':'application/json'},
  {host,origin:'null','content-type':'application/json'}, {host,origin:'http://localhost:3118','content-type':'application/json'},
  {host,'sec-fetch-site':'cross-site','content-type':'application/json'}, {host,'content-type':'text/plain'}, {host,'content-type':'application/x-www-form-urlencoded'},
  {host,'content-type':'application/json;boundary=x','sec-fetch-site':'same-site'}, {host}]){
  assert.ok(requestBoundary(request(h),3118),'unexpectedly accepted '+JSON.stringify(h));
 }
});

test('v1.8.9 live API rejects foreign-website edits without changing stored project',async()=>{
 const h=await harness(extractor);try{
  const a=await h.request('/api/analyze',{contractText:source(400)});
  const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Original',persistEvidence:true});
  const id=saved.body.project.id;const endpoint=`http://127.0.0.1:${h.port}/api/projects/${id}/rename`;
  const call=async headers=>{const res=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({name:'Hacked'})});return res.status;};
  const json='application/json';
  assert.equal(await call({'Content-Type':json,Origin:'https://foreign.example'}),403);
  assert.equal(await call({'Content-Type':json,Origin:'null'}),403);
  assert.equal(await call({'Content-Type':json,'Sec-Fetch-Site':'cross-site'}),403);
  assert.equal(await call({'Content-Type':'text/plain'}),415);
  assert.equal(await call({'Content-Type':'application/x-www-form-urlencoded'}),415);
  const spoof=await new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:h.port,path:`/api/projects/${id}/rename`,method:'POST',headers:{Host:`foreign.example:${h.port}`,'Content-Type':json}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(JSON.stringify({name:'Poisoned'}));});
  assert.equal(spoof,403);
  assert.equal(await call({'Content-Type':json,Origin:`http://localhost:${h.port}`}),403);
  assert.equal((await h.request(`/api/projects/${id}`)).body.project.name,'Original');
  assert.equal(await call({'Content-Type':json,Origin:`http://127.0.0.1:${h.port}`}),200);
  assert.equal((await h.request(`/api/projects/${id}`)).body.project.name,'Hacked');
 }finally{await h.close();}
});

test('v1.8.9 diff is source-backed and never confuses evidenced terms with authorization',()=>{
 const a={id:'v1',sourceText:source(400),decisions:[{canonicalId:'m1',title:'Research summary',amount:null,source_excerpt:source(400),riskCodes:['AMENDMENT_UNCONFIRMED'],approvalStatus:'pending'}]};
 const b={id:'v2',sourceText:source(500),decisions:[{canonicalId:'m1',title:'Research summary',amount:'500.00',source_excerpt:source(500),riskCodes:[],approvalStatus:'pending'}]};
 const r=compareAgreementVersions(a,b);assert.equal(r.rows.length,1);assert.equal(r.rows[0].beforeStatus.kind,'blocked');
 assert.equal(r.rows[0].afterStatus.kind,'evidenced');assert.match(r.rows[0].afterStatus.label,/separate approval/);
 assert.equal(r.rows[0].beforeQuote,source(400));assert.equal(r.rows[0].afterQuote,source(500));
 assert.equal(r.rows[0].after.approvalStatus,'pending');
 assert.equal(compareAgreementVersions(a,a),null);
});

test('v1.8.9 never manufactures source quotes; ambiguous milestone matching stays unmatched',()=>{
 const old={id:'old',sourceText:'text USD 400',decisions:[{canonicalId:'1',title:'Work',amount:'400',source_excerpt:'fabricated',riskCodes:[]},{canonicalId:'2',title:'Work',amount:'410',source_excerpt:'fabricated',riskCodes:[]}]};
 const next={id:'new',sourceText:'text USD 700',decisions:[{canonicalId:'3',title:'Work',amount:'700',source_excerpt:'fabricated',riskCodes:[]}]};
 const r=compareAgreementVersions(old,next);
 assert.equal(r.rows.length,3);assert.equal(r.rows[0].change,'added');assert.equal(r.rows[0].afterQuote,null);
 assert.equal(r.rows[1].change,'removed');
 assert.equal(compareAgreementVersions(old,{id:'legacy'}).incomplete,true);
 assert.equal(termStatus({amount:'0',riskCodes:[]}).kind,'blocked');
});

test('v1.8.9 resolves new evidence through the existing guarded Server API, preserving version and blocking stale approvals',async()=>{
 const h=await harness(extractor);try{
  const a=await h.request('/api/analyze',{contractText:source(400)});
  const saved=await h.request('/api/projects',{analysisId:a.body.analysisId,name:'Maple',persistEvidence:true});assert.equal(saved.status,201);
  const p=saved.body.project;
  const updated=await h.request(`/api/projects/${p.id}/reanalyze`,{contractText:source(500),agreementVersionId:p.agreementVersionId,persistEvidence:true});
  assert.equal(updated.status,200);const after=updated.body.project;
  const r=compareAgreementVersions(after.agreementVersions[0],after.agreementVersions[1]);
  assert.equal(r.rows.length,1);assert.equal(r.rows[0].before.amount,'400.00');assert.equal(r.rows[0].after.amount,'500.00');
  assert.equal(after.milestones[0].approvalStatus,'pending');
  assert.equal((await h.request(`/api/projects/${p.id}/milestones/0/approval`,{status:'approved',agreementVersionId:p.agreementVersionId})).status,400);
  assert.equal((await h.request(`/api/projects/${p.id}/drafts`,{milestoneIndex:0,recipientEmail:'synthetic@example.test',confirmed:true,agreementVersionId:p.agreementVersionId})).status,400);
  assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});

test('v1.8.9 full synthetic unsigned-to-signed resolution stays blocked until separately recorded acceptance',async()=>{
 const original='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork was originally priced at USD 600. A proposed unsigned amendment suggests USD 700, but the revised fee has not been confirmed. Client acceptance is required before billing.';
 const revised='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork has a final agreed fee of USD 700, confirmed by both parties in a signed written amendment. The previous unsigned proposal is superseded. Actual client acceptance of the deliverable is required before any billing and has not yet been recorded.';
 const h=await harness(text=>({project_summary:'Synthetic Coral Packaging Design',currency_code:'USD',warnings:[],milestones:[{title:'Packaging artwork',amount:text===original?'600':'700',trigger:'actual client acceptance',source_excerpt:text}]}));
 try{
  const first=await h.request('/api/analyze',{contractText:original});assert.equal(first.status,200);
  assert.equal(first.body.milestones[0].amount,null);assert.ok(first.body.milestones[0].financialRiskCodes.length>0);
  const saved=await h.request('/api/projects',{analysisId:first.body.analysisId,name:'Synthetic Coral Packaging Design',persistEvidence:true});assert.equal(saved.status,201);
  const p=saved.body.project;assert.equal(p.milestones[0].readiness.code,'blocked');
  const result=await h.request(`/api/projects/${p.id}/reanalyze`,{contractText:revised,persistEvidence:true,agreementVersionId:p.agreementVersionId});assert.equal(result.status,200);
  const after=result.body.project;assert.equal(after.milestones[0].amount,'700.00');assert.deepEqual(after.milestones[0].financialRiskCodes,[]);
  assert.equal(after.milestones[0].readiness.code,'pending');assert.equal(after.milestones[0].approvalStatus,'pending');
  const comparisons=compareAgreementVersions(after.agreementVersions[0],after.agreementVersions[1]);
  assert.equal(comparisons.rows[0].beforeStatus.kind,'blocked');assert.equal(comparisons.rows[0].afterStatus.kind,'evidenced');
  assert.equal((await h.request(`/api/projects/${p.id}/drafts`,{milestoneIndex:0,recipientEmail:'demo@example.test',confirmed:true,agreementVersionId:after.agreementVersionId})).status,400);
  assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});

test('v1.8.9 browser comparison remains a verified, non-mutating display feature',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(app,/compareAgreementVersions/);assert.match(app,/What changed after re-analysis/);
 assert.match(server,/requestBoundary\(req,PORT\)/);assert.match(server,/['"]\/resolve-comparison\.mjs['"]:/);
});

// Regression: clicking the localhost homepage from another website is a
// top-level GET navigation and must not be treated as a cross-site API write.
test('v1.8.9.1 allows cross-site top-level navigation to public entry points only',async()=>{
  const port=3118,host=`127.0.0.1:${port}`;
  const nav=(url,extra={})=>({method:'GET',url,headers:{host,
    'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate',
    'sec-fetch-dest':'document',...extra}});
  for(const url of ['/','/index.html','/api/health'])
    assert.equal(requestBoundary(nav(url),port),null,`top-level navigation ${url} should load`);
  for(const url of ['/api/projects','/api/invoices','/app.js'])
    assert.equal(requestBoundary(nav(url),port)?.status,403,`private/other GET ${url} must stay protected`);
  assert.equal(requestBoundary(nav('/',{'sec-fetch-mode':'cors'}),port)?.status,403);
  assert.equal(requestBoundary(nav('/',{'sec-fetch-dest':'empty'}),port)?.status,403);
  assert.equal(requestBoundary(nav('/',{origin:'https://foreign.example'}),port)?.status,403);
  assert.equal(requestBoundary(nav('/',{host:'foreign.example:3118'}),port)?.status,403);
  assert.equal(requestBoundary({method:'POST',url:'/api/projects',headers:{host,
    'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate',
    'sec-fetch-dest':'document','content-type':'application/json'}},port)?.status,403);
});

test('v1.8.9.1 real HTTP server permits linked opening, but not cross-site API reads',async()=>{
  const h=await harness(extractor);
  try{
    // Node fetch() forcibly sets Sec-Fetch-Mode:cors. Use a literal HTTP
    // request so the same headers a browser navigation sends reach the server.
    const get=(path,headers)=>new Promise((resolve,reject)=>{
      const req=http.request({host:'127.0.0.1',port:h.port,path,method:'GET',headers},res=>{
        let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);
        res.on('end',()=>resolve({status:res.statusCode,body}));
      });req.on('error',reject);req.end();
    });
    const nav={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
    const homepage=await get('/',nav);
    assert.equal(homepage.status,200);assert.match(homepage.body,/FairPay/);
    const health=await get('/api/health',nav);
    assert.equal(health.status,200);
    const privateApi=await get('/api/projects',nav);
    assert.equal(privateApi.status,403);
    const crossSiteSubresource=await get('/',{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'cors','Sec-Fetch-Dest':'empty'});
    assert.equal(crossSiteSubresource.status,403);
    assert.equal((await get('/',{...nav,Origin:'https://foreign.example'})).status,403);
  }finally{await h.close();}
});
