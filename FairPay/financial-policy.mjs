/**
 * FairPay v1.3.2 conservative, deterministic FINANCIAL ROLE checks.
 * These rules are not contract interpretation or a legal opinion. They only
 * decide when the demo must refuse to prepare a PayPal draft.
 * IMPORTANT: this function is called at analysis-time AND on re-analysis;
 * prior stored projects with no v1.2 attestation fail closed for new drafts.
 */
import {normalizeUsd} from './lib.mjs';

export const FINANCIAL_POLICY_VERSION = 5;
// Additive revision preserves the frozen v1.3.2 policy-version contract while
// invalidating persisted eligibility assessed before the release safety repair.
export const FINANCIAL_POLICY_REVISION = '2026-10-16-receivable-evidence-v1';
const MONEY = /(?:\bUSD\s*|\bUS\$\s*|\$\s*)(\d(?:[\d,]*\d)?(?:\.\d{1,2})?)(?!\d)/gi;

function amounts(text) {
  const values=[];
  for (const m of String(text).matchAll(MONEY)) {
    try { values.push(normalizeUsd(m[1].replaceAll(',',''))); } catch { /* no proof */ }
  }
  return [...new Set(values)];
}

/** Restrict checks to a given milestone's clause when milestones are numbered. */
function milestoneScope(text, index, count) {
  if(count<=1)return text;
  const tags=[...String(text).matchAll(/\bMilestone\s*(\d+)\s*:/gi)];
  const hit=tags.find(x=>Number(x[1])===index+1);
  if(!hit)return text;
  const next=tags.find(x=>x.index>hit.index);
  return text.slice(hit.index,next?.index??text.length);
}

function result(code,explanation){return {status:'blocked',riskCodes:[code],reasons:[explanation],policyVersion:FINANCIAL_POLICY_VERSION};}
export function assessFinancialTerms(agreement,index=0,count=1,excerpt='') {
  const text=String(agreement||'');
  const scope=milestoneScope(text,index,count);
  const content=scope.toLowerCase();
  const all=amounts(scope);

  // Independent adversarial audit: a quoted gross fee is not proof of an
  // outstanding *net* invoice balance. Check global billing terms even when
  // numbered-milestone clauses are scoped, and fail closed for prior credits.
  // A future unpaid deposit is not an existing credit. No automatic arithmetic
  // or allocation across milestones is attempted by this small prototype.
  const creditWord=/\b(?:deposit|retainer|advance|prepayment|credit)\b/i;
  const priorPaymentWord=/\b(?:paid|received|remitted|collected|credited|applied|deducted|offset)\b/i;
  const negativePayment=/\b(?:none|never|not|unpaid)\s+(?:(?:has|have|had|was|were)\s+)?(?:been\s+)?(?:paid|received|remitted|collected|credited|applied)\b/i;
  const creditSegments=text.split(/(?<=[.!?])\s+|[\r\n]+/);
  const hasPriorCredit=creditSegments.some(part=>creditWord.test(part)&&priorPaymentWord.test(part)&&!negativePayment.test(part));
  if(hasPriorCredit)
    return result('PRIOR_PAYMENT_RECONCILIATION_REQUIRED',
      'A previously paid deposit, retainer or credit may reduce the outstanding fee. Verify the net billable balance and allocation before drafting.');

  // Conflicting pricing can be expressed without words like "conflict" or
  // "schedule". In particular, two live amounts with unresolved priority must
  // not let a source-matched quote of just one amount become authorization.
  if(all.length>=2 && /\b(?:both\s+(?:fees?|prices?|amounts?|terms?)\s+remain\s+(?:active|valid|in\s+force)|which\s+(?:fee|price|amount|term)\s+(?:governs?|applies?)|neither\s+(?:side|party)\s+(?:has\s+)?resolved)\b/i.test(scope))
    return result('UNRESOLVED_PRICE_PRIORITY',
      'Multiple stated fees still appear to govern the same deliverable. Obtain unambiguous controlling terms before drafting.');

  // A terminated/no-fee contract or an explicitly rejected delivery is not
  // made invoice-eligible just because an older positive fee can be quoted.
  if(/\b(?:cancelled|canceled|terminated|rescinded|voided)\b/i.test(scope)
     && /\b(?:no\s+(?:fee|payment|amount)\s+is\s+owed|no\s+fee\s+(?:will\s+be|is)\s+payable|nothing\s+is\s+owed)\b/i.test(scope))
    return result('NO_FEE_AFTER_TERMINATION','The agreement states the engagement ended with no amount owed. Do not draft against an earlier stated fee.');
  if(/\b(?:rejected|declined)\b/i.test(scope)
     && /\b(?:deliverable|acceptance|accepted|approval)\b/i.test(scope))
    return result('ACCEPTANCE_EXPLICITLY_REFUSED',
      'The source explicitly records rejected work or declined acceptance. A later verifiable acceptance is required.');

  // P0 / HA02: a proposed but UNCONFIRMED change to the amount is not
  // an effective invoice amount. This is independent of the AI's excerpt:
  // the LLM may quote only the old fixed fee and ignore a later memo.
  // Do not use generic "revision" as a trigger: creative revision approval
  // is a valid acceptance milestone and is not a financial amendment.
  const feeChangeProposal = /\b(?:propos(?:e|es|ed|al)|suggest(?:s|ed|ion)?|tentative|draft|unsigned|unexecuted|pending|may\s+(?:revise|change)|discussed)\b/i.test(scope);
  const unresolvedChange = /\b(?:unsigned|unexecuted|unconfirmed|not\s+(?:yet\s+)?(?:been\s+)?(?:confirmed|approved|signed|agreed|accepted|finali[sz]ed|executed)|(?:have|has)\s+not\s+(?:yet\s+)?(?:been\s+)?(?:confirmed|approved|signed|agreed|accepted|finali[sz]ed|executed)|(?:was|were)\s+not\s+(?:yet\s+)?(?:confirmed|approved|signed|agreed)|pending\s+(?:approval|signature|agreement)|awaiting\s+(?:approval|signature|agreement)|subject\s+to\s+(?:approval|agreement)|no\s+(?:signed|confirmed|final)\s+(?:agreement|amendment))\b/i.test(scope);
  // A05: an old fixed fee is NOT safely billable if a subsequent communication
  // says the parties may change its amount, but a revised fee has not been
  // agreed or signed. Unlike HA02, there may be NO second numeric figure.
  // Require a financial-change proposal AND a negative revised-fee finality
  // statement; bare creative/design revisions must not trigger this gate.
  const noRevisedFeeAgreed = /\b(?:no|without)\s+(?:(?:final|signed|confirmed|agreed)\s+)?(?:revised|amended|updated|new|proposed)\s+(?:fee|price|amount|rate)\s+(?:(?:is|was|has\s+(?:yet\s+)?been|had\s+been)\s+)?(?:agreed|confirmed|approved|signed|finali[sz]ed|accepted)\b/i.test(scope)
    || /\b(?:revised|amended|updated|proposed|changed)\s+(?:fee|price|amount|rate)\s+(?:is|was|remains?)\s+(?:not\s+(?:agreed|signed|approved|confirmed|finali[sz]ed)|unconfirmed|unsigned|unagreed)\b/i.test(scope);
  const financialChange = /\b(?:revis(?:e|ed|ion)|amend(?:ment|ed)?|chang(?:e|ed)|adjust(?:ment|ed)?|modif(?:y|ied|ication)|replace(?:d|ment)?|supersed(?:e|es|ed)|propos(?:e|es|ed|al)|new\s+(?:fee|price|amount)|alternat(?:e|ive)\s+(?:fee|price|amount))\b/i.test(scope)
    && /\b(?:fee|price|amount|charge|rate|billable|billing|payment|invoice|pricing)\b/i.test(scope);
  // Both a claimed base fee and a changed figure (or express revision to the
  // effective fee) are required, preventing unrelated unsigned design memos
  // from blocking a plainly agreed single fee.
  if (feeChangeProposal && (unresolvedChange || noRevisedFeeAgreed) && financialChange &&
      (all.length >= 2 || noRevisedFeeAgreed || /\b(?:revised|amended|updated|proposed|changed)\s+(?:the\s+)?(?:fee|price|amount)\b/i.test(scope))) {
    return result('UNCONFIRMED_FINANCIAL_AMENDMENT',
      'A proposed or unsigned fee revision has not been confirmed. The effective billable fee requires clarification; no draft can be created.');
  }

  // Rate-only contracts MUST fail closed. A numeric unit rate is not a billable
  // milestone total. Do not rely on an exact negative-hours phrase: the same
  // missing information can be written in many ways ("no hours logged", "TBD", etc.).
  const rateAmount = /(?:\bUSD\s*|\bUS\$\s*|\$\s*)\d[\d,]*(?:\.\d{1,2})?\s*(?:\/\s*(?:h(?:ou)?r|day|week|unit)|per\s+(?:hour|day|week|unit)\b)/i.test(scope);
  const hasRateLanguage = rateAmount || /\b(?:hourly|daily|weekly|per\s+(?:hour|day|week|unit)|unit\s+rate)\b/i.test(scope);
  // In the prototype, mixed hourly + flat-fee agreements remain blocked for
  // review: we cannot safely infer that a flat fee supersedes the variable rate.
  if (hasRateLanguage && (all.length || /\b(?:TBD|quantity|payable\s+hours?)\b/i.test(scope)))
    return result('RATE_REQUIRES_BILLABLE_TOTAL','Unit or hourly pricing is not an invoice total. Verify the payable quantity and an explicitly agreed invoice total in an updated agreement.');

  if(/\b(?:estimate|estimated|preliminary|indicative|nonbinding|non-binding)\b/i.test(scope)
    && /\b(?:non-?binding|will\s+be\s+negotiated|no\s+(?:agreed|confirmed|final)|not\s+(?:agreed|accepted|final)|remains?\s+(?:negotiable|unconfirmed)|subject\s+to\s+(?:negotiation|approval))\b/i.test(scope))
    return result('NONBINDING_ESTIMATE','An estimate is mentioned but the final agreed fee has not been confirmed.');

  if(/\b(?:budget\s+(?:cap|ceiling)|maximum\s+budget|not\s+to\s+exceed)\b/i.test(scope)
    && /\b(?:negotiable|not\s+fixed|not\s+agreed|remains?\s+(?:negotiable|unconfirmed))\b/i.test(scope))
    return result('BUDGET_IS_NOT_FEE','Budget limits cannot be treated as an agreed invoice amount.');

  if(/\b(?:optional|possible|may\s+cost|if\s+requested|rush\s+(?:fee|work)|surcharge)\b/i.test(scope)
    && /\b(?:not\s+(?:authorized|agreed|approved)|billable\s+total\s+is\s+not\s+agreed|unconfirmed|not\s+confirmed|subject\s+to\s+approval)\b/i.test(scope))
    return result('OPTIONAL_FEE_UNRESOLVED','An optional charge or scope change is unresolved; the billable total is not confirmed.');

  if(/\b(?:deposit|retainer|advance|credit(?:ed)?|credit\s+already\s+paid)\b/i.test(scope)
    && /\b(?:unreconciled|not\s+(?:been\s+)?reconciled|not\s+clarif(?:y|ied)|unclear|does\s+not\s+clarify|remaining\s+(?:invoice\s+)?balance|outstanding\s+balance\s+(?:unknown|unclear))\b/i.test(scope))
    return result('DEPOSIT_BALANCE_UNRESOLVED','The deposit or credit has not been reconciled to the remaining invoice balance.');

  if(/\b(?:another\s+clause|appendix|schedule|same\s+(?:\w+\s+){0,4}(?:milestone|delivery|deliverable|work|service)|different\s+(?:prices?|fees?)|conflict(?:ing)?)\b/i.test(scope)
    && all.length>=2 && (!/\b(?:supersedes?\s+(?:the\s+)?original|replaces?\s+(?:the\s+)?original|changed\s+to|revised\s+to|updated\s+to)\b/i.test(scope)
      || /\b(?:neither\s+clause|no\s+stated\s+amendment|without\s+any\s+priority)\b/i.test(scope)))
    return result('CONFLICTING_MILESTONE_FEES','Two conflicting prices appear to apply to the same milestone with no clear priority rule.');

  if(/\b(?:billable\s+total\s+is\s+not\s+agreed|no\s+agreed\s+final\s+price|no\s+final\s+price\s+(?:was\s+)?agreed)\b/i.test(scope))
    return result('UNAGREED_TOTAL','The agreement expressly says the final billable amount is not agreed.');

  return {status:'clear',riskCodes:[],reasons:[],policyVersion:FINANCIAL_POLICY_VERSION};
}
