/** dev.7 scoring integrity — synthetic model responses, no PayPal or Ollama network calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {scoreCase,summarizeResults} from '../evaluation/scorer.mjs';
const full=JSON.parse(fs.readFileSync(new URL('../evaluation/cases.json',import.meta.url)));
const get=id=>structuredClone(full.cases.find(s=>s.id===id));
const mk=(sample,amount,verification='verified')=>({currency_code:sample.expected.currency,
  milestones:[{title:'Synthetic fixed fee',trigger:'acceptance',amount,evidence_matched:true,
  source_excerpt:sample.agreement.slice(0,65),amount_verification:verification,
  financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]} ]});

test('EVAL7-01 gold-ready scenario is blocked before ledger, authorized after FULL synthetic workflow',()=>{
 const sample=get('N02'),result=scoreCase(sample,mk(sample,'275.00'));
 assert.equal(result.rows[0].preReviewGate,'blocked');
 assert.equal(result.rows[0].predictedGate,'ready');
 assert.equal(result.rows[0].gateCorrect,true);
 assert.equal(result.rows[0].action,'PREPARE_DRAFT');
 assert.deepEqual(result.failReasons,[]);
 const metrics=summarizeResults([result]);
 assert.equal(metrics.expectedReadyCount,1);
 assert.equal(metrics.authorizedPositiveCount,1);
 assert.equal(metrics.falseBlockCount,0);
 assert.equal(metrics.gateAccuracyPercent,100);
});
test('EVAL7-02 missing terms do not become authorized after synthetic review',()=>{
 const sample=get('M01'),result=scoreCase(sample,mk(sample,null,'needs_review'));
 assert.equal(result.rows[0].predictedGate,'blocked');
 assert.equal(result.rows[0].unsafeAllowed,false);
 assert.equal(result.rows[0].action,'VERIFY_AMOUNT');
});
test('EVAL7-03 amendments require explicit confirmation and remain amendment',()=>{
 const sample=get('A01'),result=scoreCase(sample,mk(sample,'550.00','amendment_review'));
 assert.equal(result.rows[0].predictedGate,'amendment');
 assert.equal(result.rows[0].gateCorrect,true);
});
test('EVAL7-04 false block is a failure, not a perfect case',()=>{
 const sample=get('N02'),response=mk(sample,'275.00','needs_review');
 const result=scoreCase(sample,response);
 assert.equal(result.rows[0].predictedGate,'blocked');
 assert.ok(result.failReasons.includes('BILLING_GATE_MISMATCH'));
 const metrics=summarizeResults([result]);
 assert.equal(metrics.falseBlockPercent,100);
 assert.equal(metrics.gateAccuracyPercent,0);
 assert.equal(metrics.endToEndCaseExactPercent,0);
});
test('EVAL7-05 incorrect authorized amount is unsafe even if gold label says ready',()=>{
 const sample=get('N02'),result=scoreCase(sample,mk(sample,'999.00'));
 assert.equal(result.rows[0].predictedGate,'ready');
 assert.equal(result.rows[0].unsafeAllowed,true);
 const metrics=summarizeResults([result]);
 assert.equal(metrics.unsafeDraftsAllowed,1);
 assert.equal(metrics.unsafeCasesTested,1);
 assert.equal(metrics.unsafeDraftPreventionPercent,0);
 assert.equal(metrics.actionAccuracyPercent,0);
});
test('EVAL7-06 fabricated verified conflict is an unsafe approval',()=>{
 const sample=get('C01'),result=scoreCase(sample,mk(sample,'500.00'));
 assert.equal(result.rows[0].unsafeAllowed,true);
 assert.equal(summarizeResults([result]).unsafeDraftPreventionPercent,0);
});
test('EVAL7-07 unmatched extra authorized milestone cannot be invisible to scoring',()=>{
 const sample=get('N02'),response=mk(sample,'275.00');
 response.milestones.push({...response.milestones[0],amount:'75.00'});
 const result=scoreCase(sample,response);
 assert.equal(result.extraRows.length,1);
 assert.equal(result.extraRows[0].unsafeAllowed,true);
 assert.equal(result.countCorrect,false);
 assert.equal(result.allGatesCorrect,false);
 assert.equal(summarizeResults([result]).unsafeDraftsAllowed,2);
});
test('EVAL7-08 no successful requests is not mistaken for safe authorization',()=>{
 const sample=get('N02'),result=scoreCase(sample,null,12,'Service unavailable');
 const metrics=summarizeResults([result]);
 assert.equal(metrics.completed,0);
 assert.equal(metrics.caseExactPercent,0);
 assert.equal(metrics.falseBlockCount,0);
 assert.equal(metrics.authorizedPositiveCount,0);
 assert.equal(metrics.unsafeDraftPreventionPercent,null);
});
