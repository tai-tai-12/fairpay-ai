import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('import completion uses a separate accessible receipt, not a save/success claim',()=>{
  assert.match(html,/id="importReceipt"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
  for(const id of ['importReceiptTitle','importReceiptDetails','editImportedText','documentStatus'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(js,/not analyzed or saved/);
  assert.match(js,/Existing agreement text is unchanged/);
});
test('an existing unsaved source must be confirmed before a new import overwrites it',()=>{
  assert.match(js,/if\(\$\('agreement'\)\.value\.trim\(\)&&!confirm\(/);
  assert.match(js,/Unsaved edits in the text box will be replaced/);
  assert.match(js,/state\.importBusy=true/);
  assert.match(js,/state\.importBusy=false/);
});
test('file import surfaces explicit error states and remains nonfinancial',()=>{
  assert.match(js,/async function runImport\(file\)/);
  assert.match(js,/Import failed:.*saved projects were not changed/);
  assert.match(js,/fileInput\.onchange.*runImport\(file\)/);
  assert.match(js,/drop\.addEventListener\('drop'.*runImport\(file\)/);
});
test('downloads describe a browser request, not verified disk persistence',()=>{
  assert.match(html,/id="exportStatus"[^>]*role="status"/);
  assert.match(js,/FairPay cannot verify that it was saved/);
  assert.match(js,/Print \/ Save PDF|Opening the print dialog/);
});
test('visual affordances support reduced motion and mobile widths',()=>{
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(max-width:650px\)/);
  assert.match(css,/\.journey-amount:last-child/);
  assert.match(css,/\.drop-zone\[data-state="error"\]/);
});
test('navigation remains a real hash route to the three retained workspaces',()=>{
  for(const page of ['projects','agreement','payments'])assert.match(html,new RegExp(`data-page="${page}"`));
  assert.match(js,/window\.addEventListener\('hashchange'/);
  assert.match(js,/document\.querySelector\(`\[data-page=\$\{page\}\]`\)/);
});
