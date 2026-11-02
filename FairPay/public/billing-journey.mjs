/** Presentation-only workflow. Never used as authorization or payment policy. */
export function getBillingJourney(project, milestone) {
  const invoice=milestone?.invoices?.at(-1)||null;
  const source=Boolean(milestone?.amount!=null && milestone?.evidence_matched);
  const row=project?.receivable?.status==='HUMAN_RECORDED'
    ? project.receivable.milestones?.find(r=>r.milestoneId===milestone?.canonicalId) : null;
  const ledger=Boolean(row);
  const accepted=milestone?.approvalStatus==='approved';
  const draft=Boolean(invoice);
  const status=String(invoice?.status||'').toUpperCase();
  const stages=[
    {id:'source',label:'Contract evidence',done:source},
    {id:'ledger',label:'Financial review',done:ledger},
    {id:'acceptance',label:'Client acceptance',done:accepted},
    {id:'draft',label:'Sandbox invoice',done:draft}
  ];
  let next='source';
  if(draft)next=status==='DRAFT'?'draft-review':status==='PAID'?'paid':'status-review';
  else if(!source || (milestone?.amount_verification==='amendment_review'&&!milestone?.amendmentConfirmed))next='source';
  else if(!ledger)next='ledger';
  else if(!accepted)next='acceptance';
  else next='draft';
  return {stages,next,invoice,row,source,ledger,accepted,draft,amountMinor:row?.outstandingMinor??null,
    grossMinor:row?.grossMinor??null, creditedMinor:row?.creditedMinor??null};
}
