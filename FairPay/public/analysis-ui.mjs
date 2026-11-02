/** Presentation-only helpers; never determine invoice authorization here. */
export function suggestProjectName(contractText, modelSummary = '') {
  const text=String(contractText||'');
  const match=text.match(/(?:^|[\n\r]|[.;]\s+)Project\s*(?:name|title)?\s*:\s*([^\n\r]{1,120})/i);
  if(match){
    let name=match[1].split(/\.\s+(?=(?:Milestone|Payment|Client|Fee|Deliverable|Phase|Stage)\b)/i)[0].split(/[\n\r]/)[0].trim();
    name=name.replace(/[.\s]+$/,'');
    if(name.length>=3 && name.length<=80)return name;
  }
  const summary=String(modelSummary||'').trim();
  if(summary.length>=3 && summary.length<=70 && !/[\n\r]/.test(summary) && !/^(project|milestone)\s*:/i.test(summary))return summary;
  return 'Agreement review';
}
const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').replace(/[.!\s]+$/,'').toLowerCase();
export function verifiedReasons(analysis){
  const entries=[];
  for(const m of (analysis?.milestones||[])){
    for(const reason of m.financialRiskReasons||[])if(typeof reason==='string'&&reason.trim())entries.push(reason.trim());
  }
  for(const message of analysis?.warnings||[]){
    if(typeof message!=='string'||!message.trim())continue;
    // API warnings are server-generated, not freeform model prose as of v1.8.2.
    entries.push(message.trim());
  }
  const used=new Set();return entries.filter(s=>{let k=normalize(s).replace(/^milestone\s*\d+\s*:\s*/,'');if(used.has(k))return false;used.add(k);return true;});
}
export function billingSummary(analysis){
  const milestones=analysis?.milestones||[];
  const blocked=milestones.some(m=>m.amount==null||['needs_review','blocked'].includes(m.amount_verification)||(m.financialRiskCodes||[]).length>0);
  const amended=!blocked&&milestones.some(m=>m.amount_verification==='amendment_review');
  const status=blocked?'Review required':amended?'Amendment review':'Amounts source-checked';
  const headline=blocked?'Not ready to invoice':amended?'Confirm the amendment':'Review client acceptance';
  const next=blocked?'Save for review and provide clarified written terms before invoicing.':amended?'Review the controlling amendment and obtain actual client acceptance.':'Verify actual client acceptance before authorizing a Sandbox draft.';
  const reasons=verifiedReasons(analysis);
  const primary=blocked?(reasons.find(s=>/amendment|revis|fee|price|amount|quantity|hour|conflict|unsigned|uncertain|unknown/i.test(s))||reasons[0]||'An amount or source term needs verification.')
    :amended?'The controlling amendment must be confirmed before billing.':'Source amounts were checked; client acceptance and draft authorization are separate.';
  return {blocked,amended,status,headline,next,primary,reasons};
}

export function quotedAmounts(text){
 const values=[];
 const matches=String(text||'').matchAll(/(?:\bUSD\s*|\bUS\$\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)(?![\d,]|\.\d)/gi);
 for(const m of matches){const value=Number(m[1].replaceAll(',',''));if(Number.isFinite(value)&&value>0&&value<=99999999){const formatted='USD '+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});if(!values.includes(formatted))values.push(formatted);}}
 return values.slice(0,6);
}

/** Exact substrings of user-supplied text. Not fee classifications or billing authorization. */
export function amountSourceMentions(contractText, max = 4){
 const raw=String(contractText||'');const found=[];const seen=new Set();
 const pattern=/(?:\bUSD\s*|\bUS\$\s*|\$\s*)(\d[\d,]*(?:\.\d{1,2})?)(?![\d,]|\.\d)/gi;
 for(const m of raw.matchAll(pattern)){
  const value=Number(m[1].replaceAll(',',''));
  if(!Number.isFinite(value)||value<=0||value>99999999)continue;
  const before=raw.slice(Math.max(0,m.index-155),m.index);
  const cut=Math.max(before.lastIndexOf('. '),before.lastIndexOf('\n'));
  const start=m.index-before.length+(cut>=0?cut+ (before[cut]==='.'?2:1):0);
  const after=raw.slice(m.index,Math.min(raw.length,m.index+180));
  const endAt=after.search(/\.\s|\n/);
  const end=endAt>=0?m.index+endAt+1:Math.min(raw.length,m.index+180);
  const excerpt=raw.slice(start,Math.max(end,m.index+m[0].length)).trim();
  const key=String(value)+':'+excerpt.toLowerCase();
  if(seen.has(key))continue;seen.add(key);
  found.push({label:'USD '+value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),excerpt,exactMention:m[0]});
  if(found.length>=max)break;
 }
 return found;
}
