/**
 * v1.9.0 Initial local HTTP smoke test. NO Ollama call, PayPal write or private
 * user projects. Starts a child server with an isolated temporary data root,
 * empty credentials and a random localhost port; always cleans up.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=await fs.mkdtemp(path.join(os.tmpdir(),'fairpay-v190-smoke-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const choosePort=()=>new Promise((resolve,reject)=>{
  const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{
    const p=s.address().port;s.close(()=>resolve(p));
  });
});
const port=await choosePort();
const child=spawn(process.execPath,['server.mjs'],{
  cwd:project,
  env:{...process.env,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),
       FAIRPAY_TEST_DATA_ROOT:root,AI_PROVIDER:'ollama',OLLAMA_PORT:'9',
       PAYPAL_CLIENT_ID:'',PAYPAL_CLIENT_SECRET:'',DEMO_USERNAME:'',DEMO_PASSWORD:''},
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',b=>{logs+=String(b).slice(0,500)});
child.stderr.on('data',b=>{logs+=String(b).slice(0,500)});
function call(url, headers={},method='GET', body='') {
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:url,method,
      headers:{Host:`127.0.0.1:${port}`,...headers}},res=>{
      const chunks=[];res.on('data',b=>chunks.push(b));
      res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);req.setTimeout(5000,()=>req.destroy(new Error('Request timeout')));
    if(body)req.write(body);req.end();
  });
}
let checks=0;
function ensure(truth,message){if(!truth)throw Error(message);console.log('PASS  '+message);checks++}
try{
  let ready=false;
  for(let i=0;i<80;i++){
    if(child.exitCode!==null)break;
    try{const r=await call('/api/health');if(r.status===200){ready=true;break}}catch{}
    await sleep(80);
  }
  ensure(ready,'Isolated local server starts successfully');
  const health=await call('/api/health');
  const h=JSON.parse(health.body);
  ensure(h.productVersion===(await fs.readFile(path.join(project,'VERSION.txt'),'utf8')).trim()&&h.sandboxOnly===true,'Version matches VERSION.txt, Sandbox only');
  ensure(h.paypalConfigured===false,'No PayPal credentials used during QA');
  for(const url of ['/','/index.html','/app.js','/style.css','/resolve-comparison.mjs','/overview-state.mjs','/payment-view.mjs','/billing-journey.mjs']){
    ensure((await call(url)).status===200,`Static ${url} is available`);
  }
  // Check every JS module imported by the browser, recursively. A missing
  // module prevents ALL application JavaScript (including sidebar links)
  // from initializing, even though index.html and app.js return 200.
  const seenModules=new Set();
  async function verifyModule(pathname){
    if(seenModules.has(pathname))return;
    seenModules.add(pathname);
    const response=await call(pathname);
    ensure(response.status===200,`Browser module ${pathname} serves HTTP 200`);
    const imports=[...response.body.matchAll(/\b(?:import|export)\s+(?:[^'\";]*?\sfrom\s*)?['\"](\.[^'\"]+)['\"]/g)];
    for(const match of imports){
      const next=new URL(match[1],`http://127.0.0.1:${port}${pathname}`).pathname;
      if(!next.startsWith('/')||next.includes('..'))throw Error(`Unsafe relative module ${next}`);
      await verifyModule(next);
    }
  }
  await verifyModule('/app.js');
  const nav={'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate','Sec-Fetch-Dest':'document'};
  ensure((await call('/',nav)).status===200,'External-link top-level GET homepage navigation is allowed');
  ensure((await call('/api/health',nav)).status===200,'Health top-level document navigation is allowed');
  ensure((await call('/api/projects',nav)).status===403,'Cross-site private API read is blocked');
  ensure((await call('/api/projects',{'Origin':'https://external.example'})).status===403,'Foreign-Origin private read is blocked');
  ensure((await call('/api/projects',{'Host':'external.example:'+port})).status===403,'Foreign Host is blocked');
  ensure((await call('/api/projects',{'Content-Type':'text/plain'},'POST','{}')).status===415,'Non-JSON modification is blocked');
  const projects=await call('/api/projects');
  ensure(projects.status===200&&Array.isArray(JSON.parse(projects.body).projects),'Local Projects API responds without importing user data');
  console.log(`\nPASS  All ${checks} isolated local baseline checks passed (no real AI / PayPal).`);
}catch(e){console.error('FAILED:',e?.message||e,'\nChild server output:',logs);process.exitCode=1}
finally{
  child.kill('SIGTERM');
  await new Promise(r=>{if(child.exitCode!==null||child.signalCode!==null)return r();child.once('exit',r);setTimeout(r,1200)});
  await fs.rm(root,{recursive:true,force:true});
}
