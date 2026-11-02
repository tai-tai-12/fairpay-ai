/** Presentation only. No claims of legal, immutable or externally authenticated audit. */
const descriptions={
 receivable_recorded:['Financial review recorded by local user','approval'],project_saved:['Review saved','project'],project_renamed:['Project renamed','project'],project_archived:['Project archived','project'],project_restored:['Project restored','project'],
 analysis_recorded:['Agreement analyzed','agreement'],reanalysis_requested:['Updated analysis requested','agreement'],reanalysis_failed:['Re-analysis failed; previous approvals invalid','agreement'],interrupted_reanalysis_recovered:['Interrupted analysis recovered','agreement'],
 approval_recorded:['Client acceptance recorded by local user','approval'],amendment_recorded:['Amendment acknowledgement recorded','approval'],clarification_prepared:['Clarification prepared, not sent','agreement'],
 draft_authorized:['Sandbox draft attempt authorized','paypal'],draft_created:['Sandbox draft creation acknowledged','paypal'],draft_reference_returned:['Invoice reference returned; status unverified','paypal'],draft_creation_uncertain:['Draft creation outcome uncertain','paypal'],draft_not_attempted:['Draft not attempted','paypal'],
 invoice_status_verified:['PayPal Sandbox status read back','paypal'],invoice_refresh_failed:['PayPal status refresh failed','paypal'],invoice_reconciliation_required:['Invoice reconciliation required','paypal']
};
export function eventDetails(event){
 const [label,group]=descriptions[event?.type]||['Legacy workflow event','other'];
 const actor=['local_user','system','ollama_local','paypal_sandbox'].includes(event?.actor)?event.actor:'legacy record · source unverified';
 const outcome=typeof event?.outcome==='string'&&event.outcome.length<50?event.outcome:'previously recorded';
 return {label,group,actor,outcome,when:event?.at||null,status:event?.status||null,
  version:event?.agreementVersionId||null,milestoneId:event?.milestoneId||null,
  invoiceId:event?.invoiceId||null,changed:event?.changed,hasComparison:Array.isArray(event?.after)};
}
export function timelineEvents(project,group='all'){
 const items=Array.isArray(project?.decisionHistory)?project.decisionHistory:[];
 return items.map((event,i)=>({event,...eventDetails(event),originalIndex:i})).filter(x=>group==='all'||x.group===group)
   .sort((a,b)=>String(b.when||'').localeCompare(String(a.when||''))||b.originalIndex-a.originalIndex);
}
export function safeAuditMarkdown(project){
 const heading=['# FairPay · Local activity history','',`Project: ${String(project?.name||'Untitled').replace(/[\r\n]/g,' ')}`,
  `Exported: ${new Date().toISOString()}`, 'Local, mutable operational records. Not proof of client identity, payment, or legal compliance.',''];
 return [...heading,...timelineEvents(project).map(x=>`- ${x.when||'Timestamp unavailable'} | ${x.label} | ${x.actor} | ${x.outcome}${x.invoiceId?' | Invoice '+x.invoiceId:''}${x.status?' | Status '+x.status:''}`)].join('\n');
}
