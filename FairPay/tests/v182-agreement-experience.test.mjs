import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {harness} from './support/server.mjs';
import {billingSummary,verifiedReasons,suggestProjectName,quotedAmounts} from '../public/analysis-ui.mjs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const script=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const EXAMPLE='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork was originally priced at USD 600. A proposed unsigned amendment suggests USD 700, but the revised fee has not been confirmed. Client acceptance is required before billing.';

test('project name uses labeled project, not entire model summary',()=>{
 assert.equal(suggestProjectName(EXAMPLE,'Project: Synthetic Coral Packaging Design. Milestone 1 blah'),'Synthetic Coral Packaging Design');
 assert.equal(suggestProjectName('Milestone 1: Logo for USD 200. Delivery upon acceptance','A short job'),'A short job');
 assert.equal(suggestProjectName('No reliable heading here','Project: '+ 'x'.repeat(90)),'Agreement review');
});
test('overview always separates billability from actual client acceptance',()=>{
 const m={title:'Packaging artwork',amount:null,amount_verification:'needs_review',financialRiskCodes:['UNCONFIRMED_AMENDMENT'],financialRiskReasons:['Unsigned $700 fee revision is not confirmed.']};
 const s=billingSummary({milestones:[m],warnings:['Milestone 1: Unsigned $700 fee revision is not confirmed.']});
 assert.equal(s.blocked,true);assert.equal(s.status,'Review required');assert.match(s.next,/clarified written terms/);assert.equal(s.reasons.length,1);
 const ready=billingSummary({milestones:[{amount:'300.00',amount_verification:'verified',financialRiskCodes:[],financialRiskReasons:[]}],warnings:[]});
 assert.equal(ready.blocked,false);assert.match(ready.next,/client acceptance/);
});
test('pending analysis is clearly shown without fake determinate percent',()=>{
 for(const id of ['analysisProgress','analysisElapsed','analysisProgressMessage','analysisOverview','analysisDetails','analysisDetailCount','saveProjectPanel']) assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/type="module" src="\/app\.js"/);
 assert.match(script,/setAnalysisProgress\(true\)/);
 assert.match(script,/finally\s*\{setAnalysisProgress\(false\);\}/);
 assert.match(script,/setInterval\(update,1000\)/);
 assert.match(script,/renderAnalysis\(data,contractText\)/);
 assert.doesNotMatch(script,/aria-valuenow|progress\.value\s*=/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(server,/\/analysis-ui\.mjs/);
});
test('model freeform hallucination never appears in server warnings or authoritative findings',async()=>{
 const h=await harness(()=>({project_summary:'Project: Synthetic Coral Packaging Design. Milestone 1',currency_code:'USD',warnings:["The source excerpt states 'USD 60' and appears to be a typo.",'USD 999 is now payable'],milestones:[{title:'Packaging artwork',amount:'600',source_excerpt:'Milestone 1: Packaging artwork was originally priced at USD 600',trigger:'client acceptance'}]}));
 try{
  const result=await h.request('/api/analyze',{contractText:EXAMPLE});
  assert.equal(result.status,200);
  assert.equal(result.body.milestones[0].amount,null);
  assert.equal(result.body.milestones[0].amount_verification,'needs_review');
  assert.equal(result.body.warnings.some(w=>w.includes('USD 60')||w.includes('999')),false);
  assert.ok(result.body.warnings.some(w=>/amendment|revis|amount/i.test(w)));
  assert.equal(h.paypalCalls(),0);
 }finally{await h.close();}
});

test('source monetary mentions preserve original USD 600 and proposed USD 700 without authorizing either',()=>{
 assert.deepEqual(quotedAmounts(EXAMPLE),['USD 600.00','USD 700.00']);
 assert.deepEqual(quotedAmounts('Milestone: USD 1,250.00, USD 1,250.00 total.'),['USD 1,250.00']);
});
