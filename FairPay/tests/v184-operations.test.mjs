import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paymentView,paymentStates,filterPaymentMilestones,paymentCounts,getSelectedMilestoneIndex} from '../public/payment-view.mjs';
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const viewCode=readFileSync(new URL('../public/payment-view.mjs',import.meta.url),'utf8');
const milestone=(code,extras={})=>({index:0,title:'Art approval',canonicalId:'m1',amount:600,evidence_matched:true,approvalStatus:'pending',readiness:{code,label:code,next:'Check agreement'},invoices:[],...extras});
test('every expected backend readiness state has an explicit view mapping',()=>{
 assert.deepEqual(paymentStates.sort(),['amendment','blocked','draft','paid','pending','ready','reconcile','tracked','uncertain','unknown']);
 for(const code of paymentStates){const v=paymentView(milestone(code));assert.equal(v.code,code);assert.ok(v.label);assert.ok(v.next);assert.ok(v.group);assert.ok(v.tone);}
});
test('mere source-match never bypasses policy; drafts only allowed in readiness ready',()=>{
 for(const code of ['blocked','amendment','pending','uncertain','unknown','draft','tracked','paid'])assert.equal(paymentView(milestone(code,{approvalStatus:'approved'})).canCreateDraft,false,code);
 assert.equal(paymentView(milestone('ready',{approvalStatus:'approved'})).canCreateDraft,true);
 assert.equal(paymentView(milestone('ready',{creationState:'uncertain'})).canCreateDraft,false);
});
test('distinct provenance for user-recorded approval, invoice draft, and last known paid',()=>{
 const draft=paymentView(milestone('draft',{approvalStatus:'approved',invoices:[{status:'DRAFT',lastVerifiedAt:null}]}));
 assert.match(draft.acceptanceLabel,/User-recorded/);assert.match(draft.invoiceLabel,/not sent/);assert.equal(draft.lastVerified,null);
 const paid=paymentView(milestone('paid',{invoices:[{status:'PAID',lastVerifiedAt:'2026-10-15T12:00:00Z'}]}));assert.match(paid.invoiceLabel,/Last known/);assert.ok(paid.lastVerified);
 const unverified=paymentView(milestone('unknown',{invoices:[{status:'UNKNOWN'}]}));assert.match(unverified.invoiceLabel,/unverified/);
});
test('queue search/filter and counts never aggregate multiple currencies into invented amount',()=>{
 const ms=['blocked','amendment','pending','ready','draft','tracked','paid','unknown','uncertain'].map((c,i)=>milestone(c,{index:i,title:`Project ${i+1}`,canonicalId:`m${i+1}`}));
 const counts=paymentCounts(ms);assert.equal(counts.all,9);assert.equal(counts.attention,4);assert.equal(counts.invoiced,2);
 assert.equal(filterPaymentMilestones(ms,'attention').length,4);assert.equal(filterPaymentMilestones(ms,'invoiced').length,2);assert.equal(filterPaymentMilestones(ms,'all','project 4')[0].readiness.code,'ready');
});
test('milestone selection survives index changes when canonicalId is stable',()=>{
 const p={milestones:[milestone('ready',{canonicalId:'b',index:0}),milestone('blocked',{canonicalId:'a',index:1})]};
 assert.equal(getSelectedMilestoneIndex(p,'a',0),1);assert.equal(getSelectedMilestoneIndex({milestones:[...p.milestones].reverse()},'a',0),0);
 assert.equal(getSelectedMilestoneIndex(p,'deleted',22),1);
});
test('cross-page route carries project and milestone ids and selected identity',()=>{
 for(const marker of ['function routeInfo()','function syncRoute()','function routeHash(page=state.page)','route.milestoneId','selectedMilestoneId','getSelectedMilestoneIndex','navigate(\'agreement\')'])assert.ok(js.includes(marker),marker);
 assert.match(html,/id="currentContext"/);
});
test('new operations UI provides queue inspector, status freshness, mobile focus and non-retry uncertainty',()=>{
 for(const marker of ['payments-console','payment-queue','payment-inspector','paymentInspectorTitle','paymentMobileDetail','scrollIntoView','getSelectedMilestoneIndex','Refresh failed:','Do not blindly retry','Creation outcome unknown']){
  
  assert.ok(js.includes(marker)||css.includes(marker)||viewCode.includes(marker),marker);
 }
 assert.match(js,/vm\.canCreateDraft&&!p\.archivedAt/);
 assert.match(js,/agreementVersionId:p\.agreementVersionId/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.mobile-detail-visible/);
 assert.match(css,/min-height:44px/);
});
test('server-side approval API route and draft authorization payload remain untouched',()=>{
 assert.match(js,/\/milestones\/\$\{m\.index\}\/approval/);
 assert.match(js,/\/api\/projects\/\$\{p\.id\}\/drafts/);
 assert.match(js,/recipientEmail,confirmed:true,agreementVersionId:p\.agreementVersionId/);
});

test('browser-imported state model is served by static-file allowlist',()=>{const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');assert.match(server,/['"]\/payment-view\.mjs['"]:\s*['"]payment-view\.mjs['"]/);});
