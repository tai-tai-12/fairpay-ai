import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {amountSourceMentions} from '../public/analysis-ui.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const js=read('../public/app.js'),html=read('../public/index.html'),css=read('../public/style.css');
const source='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork was originally priced at USD 600. A proposed unsigned amendment suggests USD 700, but the revised fee has not been confirmed. Client acceptance is required before billing.';
test('source mention comparison cites exact user text, not AI-generated clauses',()=>{
 const m=amountSourceMentions(source);
 assert.deepEqual(m.map(v=>v.label),['USD 600.00','USD 700.00']);
 assert.match(m[0].excerpt,/originally priced at USD 600/);
 assert.match(m[1].excerpt,/unsigned amendment suggests USD 700/);
 assert.ok(m.every(v=>source.includes(v.excerpt)));
 assert.deepEqual(amountSourceMentions('No monetary value'),[]);
});
test('currency display remains source mention only, not billing authorization',()=>{
 assert.match(js,/Source mentions only · not authorized fees/);
 assert.match(js,/amountSourceMentions\(contractText,4\)/);
 assert.match(js,/billingSummary\(data\)/);
});
test('across three pages, information headings and actual action states remain (Overview replaces legacy Projects heading)',()=>{
 for(const title of ['Overview','Agreement intelligence','Payments'])assert.match(html,new RegExp(`<h1>${title}<\\/h1>`));
 for(const id of ['projectsWelcome','reviewQueueSection','analysisOverview','analysisDetails','paymentOverview','paymentsWorkspace'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(js,/reviewQueueSection'\)\.hidden=isFirstRun\|\|firstLoadPending\|\|review\.length===0/);
 assert.match(js,/View all \$\{p\.milestones\.length\} milestones/);
 assert.match(js,/Stored status history/);
 assert.match(js,/payment-invoice-details/);
});
test('clear save action has one persistent save control and one navigation CTA',()=>{
 assert.match(js,/Continue to save ↓/);
 assert.match(html,/id="save"/);
 assert.match(html,/id="printAnalysis"/);
 assert.match(js,/window\.print\(\)/);
});
test('print CSS does not turn other pages into agreement PDF and hides sidebars',()=>{
 assert.match(js,/classList\.toggle\('print-analysis',printable\)/);
 assert.match(css,/@media print/);
 assert.match(css,/body\.print-analysis #projectsPage/);
 assert.match(css,/\.sidebar,\.topline,\.skip,footer,#feedback\{display:none!important\}/);
 assert.match(css,/page-break-inside:avoid/);
});
test('Sandbox payment stages and approval controls remain in existing app',()=>{
 assert.match(js,/Record actual client acceptance/);
 assert.match(js,/I authorize ONE unsent Sandbox draft/);
 assert.match(js,/vm\.canCreateDraft/);
 assert.match(js,/confirmed:true/);
 assert.match(js,/Last checked:/);
});
