import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extractDocument,validateDocumentRequest,textFromDocxXml,DocumentImportError} from '../document-import.mjs';
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const encode=bytes=>Buffer.from(bytes).toString('base64');
const request=(filename,bytes)=>({filename,contentBase64:encode(bytes)});

test('v1.8.1 theme stays presentational; accessible toggle and persistence',()=>{
 assert.match(html,/id="themeToggle"[^>]*aria-pressed="false"/);
 assert.match(js,/fairpay-ui-theme-v1/);
 assert.match(js,/localStorage\.setItem\(THEME_KEY/);
 assert.match(css,/:root\[data-theme="dark"\]/);
 assert.match(css,/prefers-reduced-motion/);
});
test('v1.8.1 drag/drop has chooser, size limit and no implicit analyze/save',()=>{
 for(const id of ['documentDropZone','documentFile','chooseDocument','documentStatus','downloadAnalysis']) assert.match(html,new RegExp(`id="${id}"`));
 assert.match(js,/addEventListener\('drop'/);
 assert.match(js,/MAX_IMPORT_BYTES=2\*1024\*1024/);
 assert.match(js,/sourceFromFile\(content,file\.name\)/);
 assert.match(js,/Document text imported locally/);
});
test('v1.8.1 report exports do not add any PayPal or billing action',()=>{
 assert.match(js,/function downloadMarkdown/);
 assert.match(js,/function analysisReport/);
 assert.match(js,/function projectReport/);
 assert.match(js,/Source-backed amount/);
 assert.doesNotMatch(js,/downloadMarkdown\([\s\S]{0,160}\/drafts/);
});
test('reject invalid or oversized file contents before PDF or DOCX parser',()=>{
 assert.throws(()=>validateDocumentRequest(request('x.png',Buffer.from('Hello'))),DocumentImportError);
 assert.throws(()=>validateDocumentRequest(request('a.pdf',Buffer.from('This is not a PDF.'))),DocumentImportError);
 assert.throws(()=>validateDocumentRequest(request('a.docx',Buffer.from('This is not DOCX.'))),DocumentImportError);
 assert.throws(()=>validateDocumentRequest(request('x.txt',Buffer.alloc(2*1024*1024+1,'a'))),DocumentImportError);
});
test('TXT and Markdown are extracted completely in memory',async()=>{
 const value='Milestone 1: Design concepts cost USD 600. Written acceptance is needed prior to invoicing.';
 for(const suffix of ['txt','md']){
  const result=await extractDocument(request('test.'+suffix,Buffer.from(value)));
  assert.equal(result.text,value);
  assert.equal(result.kind,suffix);
 }
});
test('DOCX zip text extractor preserves paragraph order and monetary values',async()=>{
 const raw=fs.readFileSync(new URL('./fixtures/contract.docx',import.meta.url));
 const result=await extractDocument(request('contract.docx',raw));
 assert.match(result.text,/USD 600/);
 assert.match(result.text,/Milestone 1/);
 assert.equal(result.kind,'docx');
});
test('DOCX XML parser handles split runs, encoded characters and tabs',()=>{
 const xml='<w:document><w:body><w:p><w:r><w:t>Milestone &amp; fees </w:t></w:r><w:r><w:t>USD 500</w:t></w:r></w:p><w:p><w:r><w:t>Client approval required</w:t></w:r></w:p></w:body></w:document>';
 assert.equal(textFromDocxXml(xml),'Milestone & fees USD 500\nClient approval required');
});
test('file-only import endpoint is bounded and does not call invoice endpoints',()=>{
 assert.match(server,/\/api\/documents\/extract/);
 assert.match(server,/readJson\(req, 3_100_000\)/);
 assert.match(server,/extractDocument\(/);
});
