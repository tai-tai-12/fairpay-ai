import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||path.join(here,'..'));
const {assessFinancialTerms}=await import(pathToFileURL(path.join(root,'financial-policy.mjs')).href);
const {createPaypalAdapter}=await import(pathToFileURL(path.join(root,'paypal-adapter.mjs')).href);
const {reconcileInvoice}=await import(pathToFileURL(path.join(root,'payment-integrity.mjs')).href);
const {cases}=JSON.parse(await fs.readFile(path.join(here,'FROZEN_ADVERSARIAL_MATRIX.json'),'utf8'));
const rows=[];
function check(name,condition,actual,expected){rows.push({id:name,pass:Boolean(condition),actual,expected});}
for(const c of cases){const r=assessFinancialTerms(c.text,c.index,c.count);check(c.id,r.status===c.expected,r.status+(r.riskCodes.length?' ('+r.riskCodes.join(',')+')':''),c.expected);}
const id='INV2-AUDIT-12345678';
const create = async({reportedAmount='500.00', email='customer@example.test'}={})=>{
 const adapter=createPaypalAdapter({base:'http://127.0.0.1:8800',credentials:()=>({id:'test',secret:'test'}),error:message=>Error(message),invoicer:()=>({given_name:'Synthetic',surname:'Test'}),
 remoteJson:async(url,options)=>{
 if(url.endsWith('/token'))return {result:{access_token:'synthetic-token'}};
 if(options.method==='POST')return {result:{id},headers:{get:()=>null}};
 return {result:{id,status:'DRAFT',amount:{currency_code:'USD',value:reportedAmount},primary_recipients:[{billing_info:{email_address:email}}]},headers:{get:()=>null}};
 }});
 return adapter.create({title:'Synthetic Audit',amount:'500.00',recipientEmail:'customer@example.test',requestId:'12345678-1111-1111-1111-111111111111'});
};
for(const [code,params,expected] of [['P01',{reportedAmount:'600.00'},'UNKNOWN'],['P02',{email:'other@example.test'},'UNKNOWN'],['P03',{},'DRAFT']]){
 try{const r=await create(params);check(code,r.status===expected,r.status+(r.readbackIssue?' '+r.readbackIssue:''),expected);}catch(e){check(code,false,String(e),expected);}
}
const mismatch=reconcileInvoice({amount:'500.00'},{amount:'500.00',total:{currency:'USD',value:'500.00'},status:'DRAFT',recipientEmail:'customer@example.test',providerRecipientEmail:'other@example.test',lastVerifiedAt:new Date().toISOString()});
check('P04',!mismatch.ok,mismatch.code,'mismatch rejected');
for(const r of rows)console.log(`${r.pass?'PASS':'FAIL'} ${r.id} expected=${r.expected} actual=${r.actual}`);
console.log(`RESULT: ${rows.filter(r=>r.pass).length}/${rows.length} PASS`);
if(rows.some(r=>!r.pass))process.exitCode=1;
if(process.env.REPORT_PATH)await fs.writeFile(process.env.REPORT_PATH,JSON.stringify({root,rows,passed:rows.filter(r=>r.pass).length,total:rows.length},null,2));
