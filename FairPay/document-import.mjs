import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const exec = promisify(execFile);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_CHARS = 12000;
const TYPES = new Set(['txt','md','pdf','docx']);

export class DocumentImportError extends Error {
  constructor(message,status=422){super(message);this.status=status;}
}

export function validateDocumentRequest(input){
  const name=typeof input?.filename==='string'?input.filename:'';
  const type=name.split('.').at(-1)?.toLowerCase();
  if(!TYPES.has(type))throw new DocumentImportError('Supported formats: TXT, MD, DOCX, and text-based PDF.',415);
  const encoded=input?.contentBase64;
  if(typeof encoded!=='string'||!encoded.length||encoded.length>Math.ceil(MAX_BYTES/3)*4+8||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new DocumentImportError('Invalid or oversized file. Maximum 2 MB.',413);
  const bytes=Buffer.from(encoded,'base64');
  if(!bytes.length||bytes.length>MAX_BYTES)throw new DocumentImportError('File must be nonempty and no larger than 2 MB.',413);
  if(type==='pdf'&&!bytes.subarray(0,1024).includes(Buffer.from('%PDF-')))throw new DocumentImportError('File is not a valid PDF.',415);
  if(type==='docx'&&bytes.subarray(0,2).toString('latin1')!=='PK')throw new DocumentImportError('File is not a valid DOCX archive.',415);
  return {type,bytes};
}
function xmlDecode(s){return s.replace(/&(?:amp|lt|gt|quot|apos|#(?:x[0-9A-Fa-f]+|\d+));/g,entity=>{
  const known={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  if(known[entity])return known[entity];
  const n=entity[2]?.toLowerCase()==='x'?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);
  return Number.isInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';
 });}
export function textFromDocxXml(xml){
 if(!/<w:document\b/.test(xml)||!/<w:body\b/.test(xml))throw new DocumentImportError('Word document did not contain readable document text.');
 const body=xml.split(/<w:body(?:\s[^>]*)?>/)[1]?.split(/<\/w:body>/)[0]||'';
 const paragraphs=[];
 for(const paragraph of body.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)||[]){
   let combined='';
   for(const token of paragraph.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\s*\/?\s*>|<w:br\s*\/?\s*>/g)||[]){
     if(/^<w:tab/.test(token))combined+='\t';
     else if(/^<w:br/.test(token))combined+='\n';
     else combined+=xmlDecode(token.replace(/^<w:t(?:\s[^>]*)?>/,'').replace(/<\/w:t>$/,''));
   }
   if(combined.trim())paragraphs.push(combined.trim());
 }
 return paragraphs.join('\n');
}
function validateText(text){
 const clean=String(text||'').replace(/\u0000/g,'').trim();
 if(clean.length<50)throw new DocumentImportError('Document has too little selectable text (minimum 50 characters). Scanned PDFs need manual transcription; no OCR is performed.');
 if(clean.length>MAX_CHARS)throw new DocumentImportError(`Document contains ${clean.length} characters; limit is ${MAX_CHARS}. Select the relevant payment terms and try again.`);
 return clean;
}
export async function extractDocument(input){
 const {type,bytes}=validateDocumentRequest(input);
 if(type==='txt'||type==='md')return {text:validateText(bytes.toString('utf8')),kind:type,source:'local text extraction'};
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fairpay-import-'));
 const filename=path.join(dir,'input.'+type);
 try{
   await fs.writeFile(filename,bytes,{mode:0o600});
   if(type==='docx'){
     let xml;
     try{({stdout:xml}=await exec('unzip',['-p',filename,'word/document.xml'],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024}));}
     catch{throw new DocumentImportError('Could not extract DOCX text. The file may be malformed or too complex.');}
     return {text:validateText(textFromDocxXml(xml)),kind:type,source:'local DOCX text extraction'};
   }
   if(process.platform!=='darwin')throw new DocumentImportError('Text-based PDF import currently requires macOS PDFKit. Use TXT or DOCX on this system.');
   // PDFKit is supplied by macOS. It extracts selectable text locally, not scanned-image OCR.
   const program=`ObjC.import('Foundation'); ObjC.import('PDFKit'); function run(argv){var url=$.NSURL.fileURLWithPath(argv[0]);var doc=$.PDFDocument.alloc.initWithURL(url);if(!doc){throw Error('PDF cannot be read');}var raw=doc.string;if(!raw){return '';}return ObjC.unwrap(raw);}`;
   let output;
   try{({stdout:output}=await exec('osascript',['-l','JavaScript','-e',program,filename],{encoding:'utf8',timeout:20000,maxBuffer:1024*1024}));}
   catch{throw new DocumentImportError('macOS PDF text extraction failed. Try copying the selectable payment clauses into the text box.');}
   return {text:validateText(output),kind:type,source:'macOS PDFKit selectable text (no OCR)'};
 } finally{await fs.rm(dir,{recursive:true,force:true});}
}
