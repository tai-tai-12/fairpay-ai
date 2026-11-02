import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspaceProgress,readOnlyDecisionGuide,invoiceReviewPreview} from '../public/trust-guide.mjs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const id='milestone-synthetic';
const milestone={canonicalId:id,index:0,amount:500,evidence_matched:true,source_excerpt:'Milestone 1: final fixed fee is USD 500.00.',approvalStatus:'pending',readiness:{code:'blocked',next:'Financial review required'},invoices:[]};
const project={currency:'USD',name:'Synthetic test',milestones:[milestone],receivable:{status:'HUMAN_RECORDED',milestones:[{milestoneId:id,grossMinor:50000,creditedMinor:10000,outstandingMinor:40000}]},receivableLedger:{id:'synthetic-ledger-001'}};

test('read-only progress never counts missing approvals or invoice as complete',()=>{
 const view=workspaceProgress(project,milestone);
 assert.deepEqual(view.stages.map(x=>x.done),[true,true,false,false]);
 assert.equal(view.current,'acceptance');assert.equal(view.completed,2);
});
test('missing ledger never claims an outstanding balance or authorization',()=>{
 const p={...project,receivable:{status:'REVIEW_REQUIRED'},receivableLedger:null};
 const v=invoiceReviewPreview(p,milestone);assert.equal(v,null);
 const explanation=readOnlyDecisionGuide(p,milestone);
 assert.match(explanation.questions[1].answer,/cannot be determined/);
});
test('gross, credits and net preview derives exact minor-unit ledger and has no write operation',()=>{
 const v=invoiceReviewPreview(project,milestone);
 assert.equal(v.amount,'USD 400.00');assert.equal(v.gross,'USD 500.00');assert.equal(v.credits,'USD 100.00');
 assert.match(v.note,/does not authorize/);
});
test('existing Sandbox draft takes priority over creating a new draft',()=>{
 const m={...milestone,approvalStatus:'approved',invoices:[{invoiceId:'INV2-SYNTHETIC',status:'DRAFT',total:{currency:'USD',value:'400.00'}}]};
 const view=workspaceProgress(project,m);assert.equal(view.current,'draft');assert.equal(view.completed,4);
 const preview=invoiceReviewPreview(project,m);assert.equal(preview.existing,true);assert.match(preview.note,/Do not create another/);
 assert.match(readOnlyDecisionGuide(project,m).summary,/do not create another/i);
});
test('ambiguous stored invoice never appears verified paid',()=>{
 const m={...milestone,invoices:[{invoiceId:'INV2-SYNTHETIC',status:'UNKNOWN'}]};
 const v=workspaceProgress(project,m);assert.match(v.label,/Verify stored invoice status/);
 assert.match(readOnlyDecisionGuide(project,m).summary,/reconcile/);
});
test('no source match prevents source stage from becoming complete',()=>{
 const m={...milestone,amount:null,evidence_matched:false,source_excerpt:''};
 const p={...project,receivable:{status:'REVIEW_REQUIRED'},receivableLedger:null};
 assert.equal(workspaceProgress(p,m).stages[0].done,false);
 assert.match(readOnlyDecisionGuide(p,m).questions[0].answer,/has not been verified/);
});
test('explanations are deterministic read-only text, never authorize payments',()=>{
 const guide=readOnlyDecisionGuide(project,milestone);
 assert.equal(guide.questions.length,3);
 assert.match(guide.questions[1].answer,/not bank-verified/);
 const original=JSON.stringify(project);
 readOnlyDecisionGuide(project,milestone);assert.equal(JSON.stringify(project),original);
 const mod=readFileSync(new URL('../public/trust-guide.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(mod,/\bfetch\s*\(|createInvoice|postInvoice|new XMLHttpRequest/);
});
test('cross-page progress, read-only guide, invoice preview and evidence marks are wired',()=>{
 assert.match(html,/id="globalJourney"[^>]*hidden/);
 assert.match(js,/function renderGlobalJourney\(/);
 assert.match(js,/function renderDecisionGuide\(/);
 assert.match(js,/function renderInvoicePreview\(/);
 assert.match(js,/function highlightedExcerpt\(/);
 assert.match(js,/createTextNode/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/@media\(max-width:620px\)/);
});
test('browser static allowlist includes new module to prevent broken navigation',()=>{
 assert.match(server,/\x27\/trust-guide\.mjs\x27:\x27trust-guide\.mjs\x27/);
 assert.match(js,/import \{workspaceProgress,readOnlyDecisionGuide,invoiceReviewPreview\} from '\.\/trust-guide\.mjs'/);
});
