/** Display-only financial state classification. Never authorizes PayPal actions. */
const attention = new Set(['blocked','amendment','uncertain','unknown','reconcile']);
const states = Object.freeze({
 blocked:{label:'Invoice blocked',tone:'blocked',group:'attention'},
 reconcile:{label:'Reconcile invoice',tone:'blocked',group:'attention'},
 amendment:{label:'Amendment review',tone:'review',group:'attention'},
 uncertain:{label:'Creation uncertain',tone:'review',group:'attention'},
 unknown:{label:'Status unverified',tone:'review',group:'attention'},
 pending:{label:'Awaiting acceptance',tone:'neutral',group:'pending'},
 ready:{label:'Ready for draft review',tone:'info',group:'ready'},
 draft:{label:'Draft · not sent',tone:'info',group:'invoiced'},
 tracked:{label:'Invoice tracked',tone:'info',group:'invoiced'},
 paid:{label:'Last known paid',tone:'success',group:'paid'}
});
export function paymentView(m){
 const code=String(m?.readiness?.code||'unknown');
 const def=states[code]||states.unknown;
 const invoice=m?.invoices?.at(-1)||null;
 const lastVerified=invoice?.lastVerifiedAt||null;
 const hasEvidence=m?.amount!=null&&Boolean(m.evidence_matched);
 return {
  code, tone:(code==='paid'&&!lastVerified)?'review':def.tone,group:def.group,label:(code==='paid'&&!lastVerified)?'Stored PAID · unverified':def.label,
  eligible:code==='ready',
  sourceLabel:hasEvidence?'Amount found in source · not authorization':'Amount not verified',
  policyLabel:code==='reconcile'?'PayPal amount or status discrepancy · inspect existing invoice':attention.has(code)?'Policy / invoice action requires review':code==='pending'?'Amount checked · acceptance pending':code==='ready'?'Eligible for authorized Sandbox draft':invoice?'See last stored invoice state':'Review payment requirements',
  acceptanceLabel:m?.approvalStatus==='approved'?'User-recorded · not client-authenticated':'Not recorded',
  invoiceLabel:!invoice?(code==='uncertain'?'Creation outcome unknown':'No PayPal invoice'):
    invoice.status==='DRAFT'?'Draft saved · not sent':invoice.status==='PAID'?(code==='reconcile'?'PAID reported · reconciliation needed':'Last known PAID'):invoice.status==='UNKNOWN'?'Status unverified':`PayPal ${String(invoice.status||'UNKNOWN')}`,
  invoice, lastVerified,
  next:m?.readiness?.next||'Review the agreement and source evidence.',
  canCreateDraft:code==='ready'&&!invoice && m?.creationState!=='uncertain'&&m?.creationState!=='creating'
 };
}
export function filterPaymentMilestones(milestones,filter='all',search=''){
 const term=String(search).trim().toLocaleLowerCase();
 return (milestones||[]).filter(m=>{
  const v=paymentView(m);
  return (filter==='all'||v.group===filter) && (!term||String(m.title).toLocaleLowerCase().includes(term)||String(m.index+1).includes(term));
 });
}
export function paymentCounts(milestones){const result={all:0,attention:0,pending:0,ready:0,invoiced:0,paid:0};for(const m of milestones||[]){result.all++;result[paymentView(m).group]++;}return result;}
export function getSelectedMilestoneIndex(project,canonicalId,index=0){
 if(!project?.milestones?.length)return 0;
 const hit=project.milestones.findIndex(m=>m.canonicalId===canonicalId);
 return hit>=0?hit:Math.min(Math.max(0,Number(index)||0),project.milestones.length-1);
}
export const paymentStates=Object.keys(states);
