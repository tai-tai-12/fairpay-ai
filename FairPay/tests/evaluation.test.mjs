import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {scoreCase,summarizeResults,chooseSamples} from '../evaluation/scorer.mjs';
const dataset=JSON.parse(await fs.readFile(new URL('../evaluation/cases.json',import.meta.url),'utf8'));
function example(id,amount,verification='verified',currency='USD'){
 const sample=dataset.cases.find(x=>x.id===id);
 const m=sample.expected.milestones[0];
 return {sample,result:{currency_code:currency,milestones:[{title:'Test milestone',amount,
  amount_verification:verification,financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[],evidence_matched:true,source_excerpt:sample.agreement.slice(0,60),trigger:'approved'}]}};
}
test('benchmark: exactly 28 independently described synthetic cases, distinct IDs and 6 categories',()=>{
 assert.equal(dataset.cases.length,28);
 assert.equal(new Set(dataset.cases.map(x=>x.id)).size,28);
 assert.deepEqual([...new Set(dataset.cases.map(x=>x.category))].sort(),['adversarial','amendment','conflict','currency','missing','normal']);
 for(const c of dataset.cases){
  assert.ok(c.agreement.length>=50);assert.ok(c.expected.milestones.length>0);
  assert.ok(c.expected.milestones.every(m=>['ready','amendment','blocked'].includes(m.gate)));
 }
});
test('benchmark: QUICK covers every risk category without sending any service requests',()=>{
 const subset=chooseSamples(dataset,true);
 assert.equal(subset.length,6);
 assert.equal(new Set(subset.map(x=>x.category)).size,6);
});
test('scoring: normal verified amount and safety gate pass when approval is simulated',()=>{
 const {sample,result}=example('N02','275.00');
 const row=scoreCase(sample,result,25).rows[0];
 assert.equal(row.amountCorrect,true);assert.equal(row.predictedGate,'ready');
 assert.equal(row.action,'PREPARE_DRAFT');assert.equal(row.unsafeAllowed,false);
});
test('scoring: missing amount cannot authorize draft, even after simulated client approval',()=>{
 const {sample,result}=example('M01',null,'needs_review');
 const row=scoreCase(sample,result).rows[0];
 assert.equal(row.amountCorrect,true);assert.equal(row.predictedGate,'blocked');
 assert.equal(row.unsafeAllowed,false);
});
test('scoring: effective amendment requires confirmation; mistaken return to old fee is incorrect',()=>{
 const {sample,result}=example('A01','550.00','amendment_review');
 const expected=scoreCase(sample,result).rows[0];
 assert.equal(expected.amountCorrect,true);assert.equal(expected.predictedGate,'amendment');
 assert.equal(expected.action,'VERIFY_AMENDMENT');
 result.milestones[0].amount='500.00';
 assert.equal(scoreCase(sample,result).rows[0].amountCorrect,false);
});
test('scoring: fabricated verified conflicted amount exposes unsafe draft allowance',()=>{
 const {sample,result}=example('C01','500.00','verified');
 const scored=scoreCase(sample,result);
 assert.equal(scored.rows[0].unsafeAllowed,true);
 const sum=summarizeResults([scored]);
 assert.equal(sum.unsafeDraftsAllowed,1);
 assert.equal(sum.unsafeDraftPreventionPercent,0);
});
test('scoring: currency gate stops non-USD attempt even if model misreads number',()=>{
 const {sample,result}=example('U01','420.00','verified','EUR');
 const scored=scoreCase(sample,result);
 assert.equal(scored.rows[0].unsafeAllowed,false);
 assert.equal(scored.rows[0].predictedGate,'blocked');
});
test('scoring: failed requests are not silently counted as passes; category aggregation robust',()=>{
 const sample=dataset.cases[0];
 const row=scoreCase(sample,null,44,'Service unavailable');
 const summary=summarizeResults([row]);
 assert.equal(summary.completed,0);assert.equal(summary.requestErrors,1);
 assert.equal(summary.caseExactPercent,0);assert.equal(summary.unsafeDraftPreventionPercent,null);
});
