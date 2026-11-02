/** UI-only preparation of a human-attested receivable ledger.
 * Authoritative validation always happens in receivables.mjs on the server.
 * This module never declares a payment verified or authorizes invoicing.
 */
const money=/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/;
export function parseExactUsd(value){
  if(typeof value!=='string'||!money.test(value))throw new Error('Enter a nonnegative USD amount with at most two decimal places; do not use commas or approximations.');
  const [w,f='']=value.split('.');return Number(w)*100+Number(f.padEnd(2,'0')||'0');
}
export function formatExactUsd(cents){
  if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Invalid exact USD cents.');
  return `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
}
const types=new Set(['deposit','retainer','partial_payment','credit','offset']);
/** Rows must have explicit provenance and allocate to exactly one milestone. */
export function prepareFinancialReview(project,confirmation,rows=[]){
  if(project?.currency!=='USD'||!project?.agreementVersionId||!Array.isArray(project.milestones)||!project.milestones.length)
    throw new Error('This reconciliation form supports only saved USD agreements.');
  if(typeof confirmation!=='string'||confirmation.trim().length<8||confirmation.length>400)
    throw new Error('Supply a human accounting review reference (8–400 characters).');
  if(!Array.isArray(rows)||rows.length>12)throw new Error('At most twelve credits can be recorded through this form.');
  const gross=[],credits=[],balance=new Map(),known=new Set(),creditRefs=new Set();let totalGross=0,totalCredits=0;
  for(const m of project.milestones){
    if(!m.canonicalId||!m.source_excerpt||m.source_excerpt.length>400||!m.amount)
      throw new Error('Every milestone needs source-backed amount evidence before review.');
    const amount=parseExactUsd(String(m.amount));if(amount<=0)throw new Error('Each gross milestone fee must be positive.');
    if(known.has(m.canonicalId))throw new Error('Repeated milestone ID.');known.add(m.canonicalId);
    balance.set(m.canonicalId,amount);totalGross+=amount;
    gross.push({milestoneId:m.canonicalId,amount:formatExactUsd(amount),currency:'USD',humanVerified:true,reference:m.source_excerpt});
  }
  rows.forEach((row,i)=>{
    const n=parseExactUsd(row.amount);
    if(n<=0)throw new Error(`Credit ${i+1}: enter an actual positive amount, or remove the row.`);
    if(!balance.has(row.milestoneId)||!types.has(row.kind))throw new Error(`Credit ${i+1}: select a supported type and milestone.`);
    if(typeof row.reference!=='string'||row.reference.trim().length<8||row.reference.length>400)
      throw new Error(`Credit ${i+1}: provide a receipt or adjustment reference (8–400 characters).`);
    const normalized=row.reference.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
    if(creditRefs.has(normalized))throw new Error(`Credit ${i+1}: each credit needs a unique receipt/credit evidence reference. This reference is already entered; do not apply one payment twice.`);
    creditRefs.add(normalized);
    balance.set(row.milestoneId,balance.get(row.milestoneId)-n);
    totalCredits+=n;
    credits.push({id:row.id,kind:row.kind,amount:formatExactUsd(n),currency:'USD',humanVerified:true,reference:row.reference.trim(),allocations:[{milestoneId:row.milestoneId,amount:formatExactUsd(n)}]});
  });
  if([...balance.values()].some(x=>x<0))throw new Error('Allocated credits exceed one or more milestone fees. No ledger was submitted.');
  if(totalCredits>totalGross)throw new Error('Total credits cannot exceed the contract value.');
  if(credits.some(c=>!c.id||credits.filter(d=>d.id===c.id).length!==1))throw new Error('Every credit needs its own unique audit ID.');
  return {gross,credits,grossMinor:totalGross,creditedMinor:totalCredits,outstandingMinor:totalGross-totalCredits,
    confirmation:{humanVerified:true,reference:confirmation.trim()}};
}
