import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));

test('v1.8 exposes three task-oriented pages without a chatbot',()=>{
 for(const route of ['projects','agreement','payments']) assert.match(html,new RegExp(`data-page="${route}"`));
 assert.match(html,/>Agreements<\/a>/);
 assert.doesNotMatch(html,/id="(?:chat|chatbot|assistantConversation)"/i);
});
test('v1.8 new-user state is separate from populated dashboard and payment data',()=>{
 for(const id of ['projectsWelcome','dashboardSummary','reviewQueueSection','projectsWorkspace','paymentsWelcome','paymentsWorkspace'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(js,/isFirstRun=state\.loaded&&state\.projectsLoadState==='ready'&&!state\.projects\.length/);
 assert.match(js,/\$\('projectsWelcome'\)\.hidden=!isFirstRun/);
 assert.match(js,/\$\('paymentsWelcome'\)\.hidden=!!p/);
});
test('v1.8 demo agreement is input-only, never manufactures projects or paid states',()=>{
 assert.match(js,/const EXAMPLE_AGREEMENT=/);
 assert.match(js,/function startExample\(\)\{newAgreement\(\)/);
 assert.match(js,/Synthetic example loaded\. Choose Analyze agreement/);
 assert.doesNotMatch(js,/function startExample\(\)[\s\S]{0,350}\/api\/projects/);
});
test('v1.8 evidence and decision views have reversible source editing',()=>{
 for(const id of ['sourceEntry','analysisResult','analysisCards','analysisDecision','editSource'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(js,/classList\.add\('has-analysis'\)/);
 assert.match(js,/\$\('editSource'\)\.onclick=/);
 assert.match(css,/\.analysis-stage-grid/);
});
test('v1.8 payment milestones keep draft authorization server-side',()=>{
 assert.match(js,/function billingCard\(/);
 assert.match(js,/vm\.canCreateDraft/);
 assert.match(js,/paymentView\(selected\)/);
 assert.match(js,/api\(`\/api\/projects\/\$\{p\.id\}\/drafts`/);
 assert.match(js,/confirmed:true,agreementVersionId:p\.agreementVersionId/);
 assert.match(js,/PayPal read-back/);
});
test('v1.8 version and mobile styling ship together',()=>{
 assert.match(pkg.version,/^\d+\.\d+\.\d+(?:\.\d+)?$/); // Version-format check, not a permanent v1.8 ceiling
 for(const marker of ['.welcome-steps','.payment-steps','.analysis-stage-grid','@media(max-width:650px)'])assert.ok(css.includes(marker),marker);
});
