import crypto from 'node:crypto';
import {FINANCIAL_POLICY_VERSION,FINANCIAL_POLICY_REVISION} from './financial-policy.mjs';
export const identity=m=>String(m.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
export function decisionSnapshot(m){return {canonicalId:m.canonicalId,title:m.title,amount:m.amount,source_excerpt:m.source_excerpt,riskCodes:[...(m.financialRiskCodes||[])],approvalStatus:m.approvalStatus,policyVersion:m.financialPolicyVersion,policyRevision:m.financialPolicyRevision};}
/** Typed local operational history. Never claim that a user action is a verified client identity.
 * Older freeform events remain readable, but all new events include provenance.
 */
const ACTOR_BY_TYPE = {
  receivable_recorded:'local_user',project_saved:'local_user',project_renamed:'local_user',project_archived:'local_user',project_restored:'local_user',
  approval_recorded:'local_user',amendment_recorded:'local_user',clarification_prepared:'local_user',draft_authorized:'local_user',
  analysis_recorded:'system',reanalysis_requested:'local_user',reanalysis_failed:'system',
  interrupted_reanalysis_recovered:'system',draft_created:'paypal_sandbox',draft_creation_uncertain:'system',
  draft_not_attempted:'system',draft_reference_returned:'system',invoice_status_verified:'paypal_sandbox',invoice_refresh_failed:'system',invoice_reconciliation_required:'system'
};
const OUTCOME_BY_TYPE = {
  draft_authorized:'authorized_only',draft_created:'confirmed_created',draft_reference_returned:'unverified_status',draft_creation_uncertain:'uncertain',
  draft_not_attempted:'not_attempted',invoice_status_verified:'verified_readback',invoice_refresh_failed:'failed',invoice_reconciliation_required:'review_required',
  reanalysis_failed:'failed',reanalysis_requested:'pending',analysis_recorded:'completed'
};
export function audit(p,type,detail={}){
 const {milestoneId=null,invoiceId=null,status=null,before,after,provenance=null,changed=null}=detail;
 p.decisionHistory??=[];
 const event={id:crypto.randomUUID(),at:new Date().toISOString(),projectId:p.id,type,
  actor:ACTOR_BY_TYPE[type]||'system',outcome:OUTCOME_BY_TYPE[type]||'recorded',
  agreementVersionId:p.agreementVersionId||null,milestoneId};
 if(invoiceId)event.invoiceId=invoiceId;
 if(status!==null)event.status=status;
 if(changed!==null)event.changed=changed;
 if(provenance)event.provenance=String(provenance).slice(0,160);
 // Preserve already established version-difference snapshots, not raw source text in new events.
 if(before)event.before=before;if(after)event.after=after;
 p.decisionHistory.push(event);
}

export function attachEvidence(p,text,oldMilestones=[]){
 if((p.agreementVersions?.length||0)>=20)throw Error('Agreement version limit reached (20).');
 const id=crypto.randomUUID(),at=new Date().toISOString();
 const before=oldMilestones.map(decisionSnapshot);
 const previous=new Map();for(const m of oldMilestones){const key=identity(m);previous.set(key,previous.has(key)?null:m);}
 for(const m of p.milestones){m.canonicalId=previous.get(identity(m))?.canonicalId||m.canonicalId||crypto.randomUUID();m.evidenceVersionId=id;m.approvalVersionId=null;m.approvalStatus='pending';m.amendmentConfirmed=false;m.reanalysisRequired=false;
 const offset=text.indexOf(m.source_excerpt||'');m.evidenceReference={versionId:id,quoteHash:hash(m.source_excerpt||''),start:offset>=0&&m.source_excerpt?offset:null,end:offset>=0&&m.source_excerpt?offset+m.source_excerpt.length:null};}
 p.agreementVersionId=id;p.agreementVersions??=[];
 p.agreementVersions.push({id,at,sourceText:text,sourceHash:hash(text),policyVersion:FINANCIAL_POLICY_VERSION,policyRevision:FINANCIAL_POLICY_REVISION,decisions:p.milestones.map(decisionSnapshot)});
 audit(p,'analysis_recorded',{before,after:p.milestones.map(decisionSnapshot)});
}
export function requireCurrentEvidence(p,expected){
 if(p.pendingAnalysis)throw Error('Re-analysis is in progress. Financial actions are blocked.');
 if(p.agreementVersionId && expected!==p.agreementVersionId)throw Error('Agreement version changed. Reload and review current evidence before authorizing.');
}
export function clarification(p,m){
 const needs=m.financialRiskReasons?.join(' ')||m.readiness?.next||'Please confirm the controlling fee and actual acceptance.';
 return `Please clarify the agreement for “${m.title}”.\n\nSource${m.evidenceVersionId?' version '+m.evidenceVersionId:''}: “${m.source_excerpt||'Source unavailable; please provide the original agreement.'}”\n\nIssue to resolve: ${needs}\n\nPlease provide the controlling agreed fee, any applicable amendment or credit, and separate confirmation of deliverable acceptance. We will re-analyze the updated agreement before preparing an invoice.\n\nThis draft has not been sent and does not establish approval.`;
}
