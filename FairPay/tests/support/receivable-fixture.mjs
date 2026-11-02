/** Test-only synthetic ledger setup. No external payment/account data. */
import assert from 'node:assert/strict';
export async function reconcileSyntheticGross(h,project){
 const base=`/api/projects/${project.id}`;
 const result=await h.request(base+'/receivable',{
  confirmed:true,expectedRevision:project.receivableLedger?.id||null,
  agreementVersionId:project.agreementVersionId,complete:true,
  confirmation:{humanVerified:true,reference:'Synthetic complete accounting review for regression test'},
  gross:project.milestones.map(m=>({milestoneId:m.canonicalId,amount:m.amount,currency:project.currency,humanVerified:true,reference:m.source_excerpt})),
  credits:[]});
 assert.equal(result.status,200,JSON.stringify(result.body));
 return result.body.project.receivableLedger.id;
}
export const grossAuthorization=(project,revision)=>({confirmed:true,agreementVersionId:project.agreementVersionId,
 ledgerRevisionId:revision,authorizedAmount:project.milestones[0].amount,netAmountConfirmed:true});
