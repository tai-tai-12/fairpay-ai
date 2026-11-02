export function normalizeUsd(input) {
  if (typeof input !== 'string' || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(input.trim())) {
    throw new Error('Enter a valid positive USD amount (up to two decimal places).');
  }
  const value = input.trim();
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0,2));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error('Amount must be greater than zero.');
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2,'0')}`;
}

export function validRecipient(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function evidenceMatches(source, excerpt) {
  if (!excerpt || excerpt.length < 8) return false;
  const norm = s => String(s).toLowerCase().replace(/\s+/g,' ').trim();
  return norm(source).includes(norm(excerpt));
}

/**
 * Cross-check one model milestone's amount against the exact quoted source.
 * Only explicit USD money tokens in a verbatim-matched quote are trusted.
 * If there is no unique source amount, deliberately require human input.
 */
export function verifyMilestoneAmount(fullAgreement, excerpt, aiAmount) {
  if (!evidenceMatches(fullAgreement, excerpt)) {
    return { amount:null, status:'needs_review', sourceAmount:null,
      reason:'The quoted source was not found in the agreement.' };
  }
  const found = [];
  const collect = (re) => {
    for (const m of String(excerpt).matchAll(re)) {
      try { found.push(normalizeUsd(m[1].replaceAll(',',''))); } catch { /* invalid amount isn't proof */ }
    }
  };
  collect(/(?:\bUSD\s*|\bUS\$\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)(?![\d,.])/gi);
  collect(/\b(\d[\d,]*(?:\.\d{1,2})?)\s*USD\b/gi);
  const distinct = [...new Set(found)];
  if (distinct.length !== 1) {
    return { amount:null, status:'needs_review', sourceAmount:null,
      reason:distinct.length === 0
        ? 'No explicit USD amount is present in this source excerpt.'
        : 'Multiple distinct USD amounts appear in this source excerpt.' };
  }
  const sourceAmount = distinct[0];
  let claimed = null;
  try { claimed = normalizeUsd(aiAmount); } catch { /* missing or invalid model amount */ }
  if (claimed === sourceAmount) return {amount:sourceAmount,status:'verified',sourceAmount,reason:null};
  return { amount:sourceAmount, status:'corrected', sourceAmount,
    reason:`AI amount ${claimed ? 'USD '+claimed : '(missing/invalid)'} did not match the literal source amount USD ${sourceAmount}; corrected from the quoted agreement. Verify before drafting.`};
}

export function safeInvoiceId(value) {
  return typeof value === 'string' && /^INV2-[A-Z0-9-]{8,64}$/i.test(value);
}

export function extractInvoiceId(body) {
  if (safeInvoiceId(body?.id)) return body.id;
  const locations = [...(body?.links || []), ...(body?.href ? [{href: body.href}] : [])];
  for (const link of locations) {
    const match = String(link?.href ?? '').match(/(INV2-[A-Z0-9-]{8,64})/i);
    if (match) return match[1];
  }
  return null;
}


/**
 * A conservative contract amendment safeguard. This is a targeted rule for a
 * short milestone-based MVP, NOT legal interpretation. If an amendment might
 * affect a milestone and we cannot identify its effective amount, block drafting.
 */
export function assessAmendment(fullAgreement, milestoneIndex, milestoneCount) {
  const text = String(fullAgreement);
  // Do not confuse ordinary revision APPROVAL (e.g. creative revisions)
  // with financial amendment. A fee/price amendment must be plausible.
  const cue = /\b(?:amendment|amended|revised|updated|supersed(?:e|es|ed)|replaces|changed)\b/i;
  if (!cue.test(text)) return null;
  const financialCue = /\b(?:contract\s+amendment|fee\s+(?:was\s+)?(?:revised|updated|changed|amended)|price\s+(?:was\s+)?(?:revised|updated|changed|amended)|(?:revised|updated|changed|amended)\s+(?:(?:the\s+)?(?:fee|price|amount)\s+)?to|amendment\s*:)\b/i;
  // 'after revision approval' is a delivery/acceptance condition, not
  // evidence that the agreed fee was amended.
  if (!financialCue.test(text) && !/\b(?:supersedes?|replaces?)\s+the\s+(?:original|old)\s+(?:amount|fee|price)\b/i.test(text)) return null;
  const explicit = [...text.matchAll(/\b(?:revised|updated|changed|amended)\s+(?:(?:the\s+)?(?:fee|price|amount)\s+)?to\s+(?:USD\s*|US\$\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)/gi)];
  const relevant = explicit.filter(match => {
    const nearby=text.slice(Math.max(0,match.index-135),Math.min(text.length,match.index+170));
    const ids=[...nearby.matchAll(/\bMilestone\s*(\d+)\b/gi)].map(x=>Number(x[1]));
    return !ids.length || ids.includes(milestoneIndex+1);
  });
  if (relevant.length === 1) {
    const m=relevant[0];
    const nearby=text.slice(Math.max(0,m.index-135),Math.min(text.length,m.index+170));
    if (/\b(?:not|never)\s+(?:been\s+)?(?:revised|updated|changed|amended)\b/i.test(nearby)) return {status:'needs_review',amount:null,reason:'Negated or uncertain amendment language; confirm the effective fee outside the AI result.'};
    let candidate;
    try{candidate=normalizeUsd(m[1].replaceAll(',',''));}catch{return {status:'needs_review',amount:null,reason:'Amended fee is not a valid USD value.'};}
    return {status:'amendment_review',amount:candidate,reason:`Contract amendment detected: USD ${candidate} appears to be the revised fee. Verify the controlling amendment and client approval before drafting.`};
  }
  if (relevant.length > 1) return {status:'needs_review',amount:null,reason:'Multiple amended fees detected; the effective amount cannot be determined safely.'};
  // If there is any financial amendment cue but we cannot connect it to this
  // milestone, do not assert that the original extracted amount is definitive.
  const likelyFinancial=/\b(?:fee|price|amount|payment|milestone)\b/i.test(text);
  if (likelyFinancial) return {status:'needs_review',amount:null,reason:'Possible contract amendment could not be reliably mapped to this milestone.'};
  return null;
}
