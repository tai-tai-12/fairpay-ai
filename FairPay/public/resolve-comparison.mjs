/** Display-only, source-backed agreement decision comparison.
 * A financial policy finding is NOT invoice eligibility or client acceptance.
 * Match only unambiguous milestone IDs or unique titles. Never synthesize a match.
 */
const normalizedTitle=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function termStatus(m) {
  if(!m)return {label:'No recorded decision',kind:'unknown'};
  if((m.riskCodes||[]).length)return {label:'Financial policy review required',kind:'blocked'};
  if(m.amount==null||!Number.isFinite(Number(m.amount))||Number(m.amount)<=0)return {label:'Billable amount unresolved',kind:'blocked'};
  return {label:'Terms evidenced — separate approval required',kind:'evidenced'};
}
function safeQuote(version,m){
  if(!m?.source_excerpt||typeof version?.sourceText!=='string')return null;
  return version.sourceText.includes(m.source_excerpt)?m.source_excerpt:null;
}
export function compareAgreementVersions(beforeVersion,afterVersion){
  if(!beforeVersion||!afterVersion||beforeVersion.id===afterVersion.id)return null;
  if(!Array.isArray(beforeVersion.decisions)||!Array.isArray(afterVersion.decisions))return {beforeId:beforeVersion.id,afterId:afterVersion.id,rows:[],incomplete:true};
  const old=beforeVersion.decisions,newer=afterVersion.decisions;
  const consumed=new Set(),rows=[];
  for(const next of newer){
    const idHits=next.canonicalId?old.filter(p=>p.canonicalId===next.canonicalId):[];
    const title=normalizedTitle(next.title);
    const titleHits=title?old.filter(p=>normalizedTitle(p.title)===title):[];
    const prev=(idHits.length===1?idHits[0]:idHits.length===0&&titleHits.length===1?titleHits[0]:null);
    const safePrev=prev&&!consumed.has(prev)?prev:null;
    if(safePrev)consumed.add(safePrev);
    rows.push({title:next.title||'Unnamed milestone',before:safePrev||null,after:next,
      beforeStatus:termStatus(safePrev),afterStatus:termStatus(next),
      beforeQuote:safeQuote(beforeVersion,safePrev),afterQuote:safeQuote(afterVersion,next),
      change:safePrev?'compared':'added'});
  }
  for(const prev of old)if(!consumed.has(prev))rows.push({title:prev.title||'Unnamed milestone',before:prev,after:null,
    beforeStatus:termStatus(prev),afterStatus:termStatus(null),beforeQuote:safeQuote(beforeVersion,prev),afterQuote:null,change:'removed'});
  return {beforeId:beforeVersion.id,afterId:afterVersion.id,rows,incomplete:false};
}
