/** Conservative reconciliation of a PayPal Sandbox read-back with the
 * exact milestone amount authorized at draft creation. Display and summaries
 * must not treat a PAID flag alone as proof the agreed amount was paid.
 * This module never changes PayPal state or authorizes any action.
 */
const asCents=(value)=>{
  if(value===null||value===undefined||!/^\d+(?:\.\d{1,2})?$/.test(String(value)))return null;
  const [whole,fraction='']=String(value).split('.');
  const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(amount)?amount:null;
};
export function reconcileInvoice(m,invoice){
  if(!invoice)return {ok:false,code:'NO_INVOICE'};
  const gross=asCents(m?.amount);
  const snap=invoice?.authorization;
  // Invoice authorization is either the source-matched gross (legacy) or the
  // exact, ledger-bound outstanding balance (dev5). Never infer net from UI.
  const expected=snap?.netAmountAuthorized===true?snap.amountMinor:gross;
  const authorized=asCents(invoice?.amount);
  const reported=invoice?.total?.currency==='USD'?asCents(invoice.total.value):null;
  // New drafts carry the exact financial-review/operation binding written
  // before the provider call. Keep legacy invoices visible, but never treat a
  // contradictory new authorization snapshot as successfully reconciled.
  if(invoice.authorization){
    const a=invoice.authorization;
    if(!a.ledgerRevisionId||!a.agreementVersionId||!a.policyRevision||
       !/^[a-f0-9-]{36}$/i.test(String(a.operationId||''))||
       a.currency!=='USD'||!Number.isSafeInteger(a.amountMinor)||
       a.amountMinor!==expected||a.amountMinor!==authorized||
       (a.netAmountAuthorized===true && (
         !Number.isSafeInteger(a.grossMinor)||!Number.isSafeInteger(a.creditedMinor)||
         a.grossMinor!==gross||a.creditedMinor<=0||a.amountMinor<=0||
         a.grossMinor-a.creditedMinor!==a.amountMinor||
         typeof a.netReviewConfirmedAt!=='string'||!Number.isFinite(Date.parse(a.netReviewConfirmedAt))
       ))||
       typeof a.recipientEmail!=='string'||
       a.recipientEmail.toLowerCase()!==String(invoice.recipientEmail||'').toLowerCase())
      return {ok:false,code:'AUTHORIZATION_EVIDENCE_MISMATCH',message:'Saved financial authorization binding is incomplete or inconsistent. Inspect the existing invoice and audit trail; never create a replacement automatically.'};
  }
  if(invoice?.providerRecipientEmail && invoice?.recipientEmail
    && invoice.providerRecipientEmail.toLowerCase()!==invoice.recipientEmail.toLowerCase())
    return {ok:false,code:'RECIPIENT_MISMATCH',message:'PayPal recipient differs from the explicitly authorized Sandbox recipient. Inspect the existing invoice; do not create another.'};
  if(invoice?.readbackIssue)
    return {ok:false,code:invoice.readbackIssue,message:'Draft read-back differed from authorization. Refresh and reconcile this existing invoice before further action.'};
  if(!invoice.total||authorized===null||expected===null||!invoice.invoiceId||!invoice.recipientEmail||!invoice.providerRecipientEmail||!invoice.lastVerifiedAt||!Number.isFinite(Date.parse(invoice.lastVerifiedAt)))
    return {ok:false,code:'INCOMPLETE_PROVIDER_EVIDENCE',message:'Provider identity, amount, currency, recipient or verification time is missing. Reconcile the existing invoice; do not create another.'};
  if(!['DRAFT','SENT','SCHEDULED','UNPAID','PAID','PARTIALLY_PAID','PAYMENT_PENDING','MARKED_AS_PAID','CANCELLED','REFUNDED','PARTIALLY_REFUNDED','MARKED_AS_REFUNDED'].includes(invoice.status))return {ok:false,code:'UNKNOWN_PROVIDER_STATUS',message:'Provider status is unverified. Refresh the existing invoice.'};
  // Existing invoices are not recreated automatically even when the read-back is incomplete.
  if(authorized!==null&&expected!==null&&authorized!==expected)
    return {ok:false,code:'AUTHORIZED_AMOUNT_CHANGED',message:'Saved invoice authorization and the current milestone amount differ. Review both records in PayPal.'};
  if(invoice.total && (reported===null || reported!==expected))
    return {ok:false,code:'INVOICE_TOTAL_MISMATCH',message:'PayPal invoice total does not match the exact financial authorization. Reconcile in PayPal; do not create another draft.'};
  if(invoice.status==='PAID'){
    if(!invoice.lastVerifiedAt||!Number.isFinite(Date.parse(invoice.lastVerifiedAt)))
      return {ok:false,code:'UNVERIFIED_PAID',message:'A stored PAID label has no verified PayPal read-back time. Refresh before recording payment.'};
    if(reported===null||expected===null)
      return {ok:false,code:'MISSING_PAID_TOTAL',message:'PayPal reports PAID, but its invoice total cannot be checked against the agreed fee.'};
    // A missing due_amount is not a denial of payment; a contradictory due amount is.
    if(invoice.dueAmount){
      const due=invoice.dueAmount.currency==='USD'?asCents(invoice.dueAmount.value):null;
      if(due!==0)return {ok:false,code:'PAID_WITH_DUE_AMOUNT',message:'PayPal reports PAID but the amount due is not verified as zero. Review the invoice in Sandbox.'};
    }
  }
  return {ok:true,code:'MATCHED'};
}
