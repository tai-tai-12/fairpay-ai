import {minorUnits} from './receivables.mjs';
import crypto from 'node:crypto';
import {safeInvoiceId,extractInvoiceId,validRecipient} from './lib.mjs';
const statuses=new Set(['DRAFT','SENT','SCHEDULED','UNPAID','PAID','PARTIALLY_PAID','PAYMENT_PENDING','MARKED_AS_PAID','CANCELLED','REFUNDED','PARTIALLY_REFUNDED','MARKED_AS_REFUNDED']);
const date=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?value:null;
const amount=value=>value&&/^[A-Z]{3}$/.test(value.currency_code)&&typeof value.value==='string'&&/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.value)?{currency:value.currency_code,value:value.value}:null;
// Only an explicitly selected Sandbox base or loopback test double is allowed.
export function createPaypalAdapter({base,credentials,remoteJson,error,invoicer}){
 if(base!=='https://api-m.sandbox.paypal.com'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Only PayPal Sandbox or loopback test adapter allowed.');
 async function token(){const {id,secret}=credentials();if(!id||!secret)throw error('PayPal Sandbox credentials not configured.',503);
 const {result}=await remoteJson(`${base}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});if(!result.access_token)throw error('PayPal token missing.');return result.access_token;}
 async function read(invoiceId,access){if(!safeInvoiceId(invoiceId))throw error('Invalid invoice ID.',400);const {result}=await remoteJson(`${base}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,{headers:{Authorization:`Bearer ${access||await token()}`,Accept:'application/json'}});
 if(result.id!==invoiceId)throw error('PayPal invoice identity did not match the requested invoice. Stored status was not changed.');
 const providerStatus=statuses.has(result.status)?result.status:'UNKNOWN';
 // Only retain the exact recipient field supplied in PayPal Invoicing v2
 // billing_info; do not echo provider payloads or unrelated private fields.
 const billingEmail=result.primary_recipients?.[0]?.billing_info?.email_address;
 const providerRecipientEmail=result.primary_recipients?.length===1&&validRecipient(billingEmail)?billingEmail:null;
 const total=amount(result.amount);
 // Missing due_amount is optional; a supplied but invalid balance is not.
 // Never discard malformed financial evidence and then accept a PAID flag.
 const dueAmount=amount(result.due_amount);
 const invalidDue=Object.hasOwn(result,'due_amount')&&!dueAmount;
 const readbackIssue=!total?'MISSING_PROVIDER_TOTAL':!providerRecipientEmail?'MISSING_PROVIDER_RECIPIENT':invalidDue?'INVALID_PROVIDER_DUE_AMOUNT':providerStatus==='UNKNOWN'?'MISSING_PROVIDER_STATUS':null;
 const status=readbackIssue?'UNKNOWN':providerStatus;
 return {invoiceId,status,providerStatus,readbackIssue,verifiedAt:status==='UNKNOWN'?null:new Date().toISOString(),total:amount(result.amount),dueAmount,providerRecipientEmail,providerCreatedAt:date(result.detail?.metadata?.create_time),dueDate:/^\d{4}-\d{2}-\d{2}$/.test(result.detail?.payment_term?.due_date||'')?result.detail.payment_term.due_date:null,source:'PayPal Sandbox read-back'};
 }
 async function create({title,amount,recipientEmail,requestId}){
 let access;try{access=await token();}catch(e){e.noFinancialWrite=true;throw e;}
 const key=typeof requestId==='string'&&/^[a-f0-9-]{36}$/i.test(requestId)?requestId:crypto.randomUUID();
 const payload={detail:{currency_code:'USD',payment_term:{term_type:'DUE_ON_RECEIPT'},note:'FairPay AI sandbox demonstration — draft only.'},invoicer:{name:invoicer?.()||{given_name:'Demo',surname:'Freelancer'}},primary_recipients:[{billing_info:{email_address:recipientEmail}}],items:[{name:title.trim(),quantity:'1',unit_amount:{currency_code:'USD',value:amount}}]};
 const {result,headers}=await remoteJson(`${base}/v2/invoicing/invoices`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','PayPal-Request-Id':key},body:JSON.stringify(payload)});
 const invoiceId=extractInvoiceId(result)||extractInvoiceId({href:headers.get('location')});if(!invoiceId)throw error('PayPal may have created a draft without returning its ID. Creation remains uncertain; inspect Sandbox before any retry.');
 try{
  const seen=await read(invoiceId,access);
  const wrongTotal=Boolean(seen.total) && (seen.total.currency!=='USD'||minorUnits(seen.total.value,'USD')!==minorUnits(amount,'USD'));
  const wrongRecipient=Boolean(seen.providerRecipientEmail) && seen.providerRecipientEmail.toLowerCase()!==recipientEmail.toLowerCase();
  // A returned invoice ID means a write may already exist. Never throw and
  // encourage a second create on a read-back discrepancy; preserve the ID.
  if(seen.readbackIssue||wrongTotal||wrongRecipient)return {...seen,status:'UNKNOWN',verifiedAt:null,requestId:key,
    readbackIssue:seen.readbackIssue||(wrongTotal?'INVOICE_TOTAL_MISMATCH':'RECIPIENT_MISMATCH'),
    note:'Sandbox draft exists or may exist, but PayPal read-back differs from authorized terms. Reconcile before any other financial action; do not retry creation.'};
  return {...seen,requestId:key};
 }catch{return {invoiceId,status:'UNKNOWN',verifiedAt:null,requestId:key,note:'Creation returned an ID but status read-back failed. Refresh this invoice; do not create another.'};}
 }
 return {read,create};
}
