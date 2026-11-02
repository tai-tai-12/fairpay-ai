import test from 'node:test';import assert from 'node:assert/strict';import {evaluate} from '../tools/sprint-a-evaluate.mjs';
test('A2 controlled positive and negative workflows retain denominators and exact net authorization',{timeout:5000},async()=>{
 const r=await evaluate();assert.equal(r.rows.length,6);assert.ok(r.rows.every(x=>x.pass));
 assert.deepEqual(r.metrics,{attempted:6,completed:6,requestErrors:0,expectedReadyCount:2,authorizedPositiveCount:2,falseBlockCount:0,positiveErrors:0,expectedBlockedCount:4,unsafeAllowCount:0,negativeErrors:0});
 assert.equal(r.rows.find(x=>x.id==='A2-P2').receivable.outstandingMinor,40000);
 const m=r.controlledScorer.metrics;assert.equal(m.expectedReadyCount,1);assert.equal(m.authorizedPositiveCount,1);assert.equal(m.falseBlockCount,0);assert.equal(m.unsafeDraftsAllowed,0);
});
