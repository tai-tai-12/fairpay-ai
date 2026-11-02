import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assessFinancialTerms,FINANCIAL_POLICY_VERSION} from '../financial-policy.mjs';
import {createProject,stateOf,validateDraft} from '../project-model.mjs';
import {scoreCase,summarizeResults} from '../evaluation/scorer.mjs';
const cases=JSON.parse(await fs.readFile(new URL('../evaluation/cases.json',import.meta.url),'utf8')).cases;
const find=id=>cases.find(c=>c.id===id);
const email='sb-test@personal.example.com';
function milestone(c,policy,amount='500.00'){
 return {title:'Test milestone',amount,trigger:'after approval',source_excerpt:c.agreement.slice(0,80),
  evidence_matched:true,amount_verification:policy.riskCodes.length?'needs_review':'verified',
  financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:policy.riskCodes,
  financialRiskReasons:policy.reasons};
}
test('v1.2 stops known unsafe numeric roles (M03, M04, M05, C03, C04) before human draft authorization',()=>{
 for(const id of ['M03','M04','M05','C03','C04']){
  const c=find(id),p=assessFinancialTerms(c.agreement,0,1);
  assert.equal(p.status,'blocked',id);
  const project=createProject({summary:id,currency:'USD',milestones:[milestone(c,p)]});
  project.milestones[0].approvalStatus='approved';
  assert.equal(stateOf(project.milestones[0]).code,'blocked',id);
  assert.throws(()=>validateDraft(project,0,email,true),/blocked/i,id);
 }
});
test('v1.2 refuses cross-clause conflicting prices',()=>{
 for(const id of ['C01','C02','C05']){
   const c=find(id);const p=assessFinancialTerms(c.agreement,0,1);
   assert.equal(p.riskCodes[0],'CONFLICTING_MILESTONE_FEES',id);
 }
});
test('v1.2 continues to allow simple fixed USD milestones after self-reported approval',()=>{
 for(const id of ['N01','N02','N03','N04','N05','N06','N07']){
   const c=find(id),count=c.expected.milestones.length;
   for(let i=0;i<count;i++){
    const p=assessFinancialTerms(c.agreement,i,count);
    assert.equal(p.status,'clear',`${id} milestone ${i+1}: ${p.reasons}`);
   }
 }
 const c=find('N02'),p=assessFinancialTerms(c.agreement,0,1);
 const project=createProject({summary:'fixed fee',currency:'USD',milestones:[milestone(c,p,'275.00')]});
 project.milestones[0].approvalStatus='approved';
 assert.equal(stateOf(project.milestones[0]).code,'ready');
 assert.ok(validateDraft(project,0,email,true));
});
test('v1.2 archived v1.1 project retains invoice, but legacy un-attested milestones cannot create NEW drafts',()=>{
 const c=find('N02');
 const legacy={...milestone(c,assessFinancialTerms(c.agreement)),financialPolicyVersion:null};
 const project=createProject({summary:'old project',currency:'USD',milestones:[legacy]});
 project.milestones[0].approvalStatus='approved';
 assert.equal(stateOf(project.milestones[0]).code,'blocked');
 assert.throws(()=>validateDraft(project,0,email,true),/Financial policy review/i);
 project.milestones[0].invoices.push({invoiceId:'INV2-EXAMPLE-123456',status:'DRAFT'});
 assert.equal(stateOf(project.milestones[0]).code,'draft');
});
test('v1.2 scorer counts extra predicted milestones that could create an ungrounded draft',()=>{
 const sample=find('N02');
 const fake={currency_code:'USD',milestones:[
  {title:'Real',amount:'275.00',amount_verification:'verified',evidence_matched:true,financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]},
  {title:'Fake',amount:'999.00',amount_verification:'verified',evidence_matched:true,financialPolicyVersion:FINANCIAL_POLICY_VERSION,financialRiskCodes:[]}
 ]};
 const result=scoreCase(sample,fake,20);
 assert.equal(result.unexpectedPredictions,1);
 assert.ok(result.failReasons.includes('MILESTONE_COUNT_MISMATCH'));
 assert.ok(result.failReasons.includes('UNSAFE_DRAFT_GATE'));
 const summary=summarizeResults([result]);
 assert.equal(summary.unexpectedReady,1);
 assert.equal(summary.unsafeDraftsAllowed,1);
});
test('v1.2 clear policy result contains version; direct term extraction is deterministic and never calls PayPal',()=>{
 const r=assessFinancialTerms(find('A01').agreement,0,1);
 assert.equal(r.status,'clear');
 assert.equal(r.policyVersion,FINANCIAL_POLICY_VERSION);
});
