import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function harness(extract,paypalHandler){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fairpay-release-test-'));
 let paypalCalls=0;
 const json=(res,obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj));};
 const ai=http.createServer(async(req,res)=>{if(req.url==='/api/tags')return json(res,{models:[{name:'qwen3:4b-instruct'}]});let body='';for await(const c of req)body+=c;try{json(res,{message:{content:JSON.stringify(await extract(JSON.parse(body).messages.at(-1).content))}});}catch{json(res,{},503);}});
 const pp=http.createServer(async(req,res)=>{paypalCalls++;if(paypalHandler)return paypalHandler(req,res,json);json(res,{},503);});
 for(const s of [ai,pp]){s.listen(0,'127.0.0.1');await once(s,'listening');}
 const reserve=http.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const env={PATH:process.env.PATH,NODE_ENV:'test',FAIRPAY_TEST_DATA_ROOT:root,PORT:String(port),HOST:'127.0.0.1',AI_PROVIDER:'ollama',OLLAMA_PORT:String(ai.address().port),MOCK_PAYPAL_BASE:`http://127.0.0.1:${pp.address().port}`,PAYPAL_CLIENT_ID:'mock',PAYPAL_CLIENT_SECRET:'mock'};
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../..',import.meta.url).pathname,env,stdio:'ignore'});
 const request=async(url,body)=>{const r=await fetch(`http://127.0.0.1:${port}${url}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const close=async()=>{if(child.exitCode===null){child.kill();await once(child,'exit');}for(const s of [ai,pp])await new Promise(r=>s.close(r));await fs.rm(root,{recursive:true,force:true});};
 try{let ready=false;for(let i=0;i<100;i++){try{if((await request('/api/health')).status===200){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,30));}if(!ready)throw Error('Test server did not start');return {request,close,root,port,paypalCalls:()=>paypalCalls};}catch(e){await close();throw e;}
}
