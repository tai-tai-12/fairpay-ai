/** FairPay action policy v1.0. This is deterministic and never initiates PayPal writes. */
const ACTIONS = {
  blocked: ['VERIFY_AMOUNT', 'High', 'Verify the missing or ambiguous contract amount', 'The quoted agreement does not establish a verified billable amount. Update and re-analyze the terms.', 'contract'],
  uncertain: ['CHECK_CREATION', 'High', 'Check whether a draft was already created', 'A previous create request may have reached PayPal. Inspect the Sandbox and reconcile the Invoice ID before retrying.', 'paypal'],
  reconcile: ['RECONCILE_INVOICE', 'High', 'Reconcile the existing PayPal invoice', 'The stored PayPal amount or payment status cannot be reconciled with the agreement. Inspect this exact invoice in Sandbox; do not make a replacement draft.', 'paypal'],
  unknown: ['REFRESH_STATUS', 'High', 'Refresh the unverified PayPal invoice status', 'An invoice ID exists, but its latest status is not confirmed by PayPal.', 'paypal'],
  amendment: ['VERIFY_AMENDMENT', 'High', 'Confirm the controlling contract amendment', 'The effective revised fee is provisional until a person reviews the amendment.', 'contract'],
  pending: ['CONFIRM_ACCEPTANCE', 'Medium', 'Confirm actual client acceptance', 'The billing trigger has not been reported as satisfied. Do not draft an invoice yet.', 'user'],
  ready: ['PREPARE_DRAFT', 'Medium', 'Review and authorize a PayPal Sandbox draft', 'Agreement amount is verified and client approval is self-reported. A separate draft authorization is still required.', 'user'],
  draft: ['REVIEW_DRAFT', 'Medium', 'Review the PayPal draft', 'The invoice is a DRAFT and has not been sent by FairPay. No payment should be inferred.', 'paypal'],
  tracked: ['REFRESH_AND_REVIEW', 'Medium', 'Refresh the PayPal invoice status', 'Check the current status with PayPal before deciding whether to follow up. FairPay does not send reminders.', 'paypal'],
  paid: ['RECORD_PAID', 'Low', 'Payment marked paid in PayPal', 'The most recently verified PayPal status reports payment; no follow-up is recommended.', 'paypal']
};
const weight={High:0,Medium:1,Low:2};
export function nextActions(project) {
  const result = (project?.milestones || []).map((m,i)=>{
    const state=m.readiness||{};
    const def=ACTIONS[state.code]||ACTIONS.unknown;
    return {milestoneIndex:Number.isInteger(m.index)?m.index:i,
      code:def[0],priority:def[1],title:def[2],reason:def[3],basis:def[4],
      status:state.code||'unknown', amount:m.amount||null,
      invoiceId:m.invoices?.at(-1)?.invoiceId||null};
  });
  return result.sort((a,b)=>weight[a.priority]-weight[b.priority] || a.milestoneIndex-b.milestoneIndex);
}
export function briefingFacts(project) {
  const actions=nextActions(project), summary=project.summary||{};
  const counts={};for(const a of actions)counts[a.status]=(counts[a.status]||0)+1;
  return {milestoneCount:actions.length,
    readyCount:counts.ready||0,pendingCount:counts.pending||0,
    blockedCount:(counts.blocked||0)+(counts.amendment||0)+(counts.uncertain||0)+(counts.unknown||0)+(counts.reconcile||0),
    draftCount:counts.draft||0,paidCount:counts.paid||0,
    confirmedPaidUsd:((summary.paidCents||0)/100).toFixed(2),
    nextActionCode:actions[0]?.code||'NONE'};
}
