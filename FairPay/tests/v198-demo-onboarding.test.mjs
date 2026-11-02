import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('first task clearly identifies the action, followed by source verification and saving',()=>{
 assert.match(html,/STEP 1 OF 3 · GET STARTED/);
 assert.match(html,/First, add your agreement/);
 for(const phrase of ['Add agreement','Review terms','Save review'])assert.ok(html.includes(phrase));
 assert.match(html,/No invoice is created, sent, or paid/);
 assert.match(html,/Nothing is analyzed until you continue/);
});
test('paste and upload are real accessible tab controls with exclusive panels',()=>{
 for(const [tab,panel] of [['pasteMethodTab','pastePanel'],['uploadMethodTab','uploadPanel']]){
  assert.match(html,new RegExp(`id="${tab}"[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*aria-controls="${panel}"`));
  assert.match(html,new RegExp(`id="${panel}"[^>]*role="tabpanel"[^>]*aria-labelledby="${tab}"`));
 }
 assert.match(js,/function setSourceMethod\(mode, focusTab=false\)/);
 assert.match(js,/\$\('pastePanel'\)\.hidden=!isPaste/);
 assert.match(js,/\$\('uploadPanel'\)\.hidden=isPaste/);
 assert.match(js,/ArrowRight','ArrowLeft','Home','End/);
});
test('upload preserves a human review step and never implicitly triggers analysis',()=>{
 assert.match(js,/sourceFromFile\(text,name,sizeBytes\)/);
 assert.match(js,/setSourceMethod\('paste'\)/);
 assert.match(html,/id="importReceipt"[^>]*role="status"/);
 assert.match(js,/\$\('agreement'\)\.value\.trim\(\)\&\&!confirm/);
 assert.doesNotMatch(js.match(/function sourceFromFile[\s\S]*?async function base64File/)?.[0]||'',/api\('\/api\/analyze/);
});
test('counter updates for typing, sample and a reset, keeping 50-character validation',()=>{
 assert.match(html,/id="sourceCharacterCount"/);
 assert.match(js,/function updateSourceCount\(/);
 assert.match(js,/\$\('agreement'\)\.oninput=\(\)=>\{updateSourceCount\(\)/);
 assert.match(js,/contractText\.trim\(\)\.length<50/);
 assert.match(js,/\$\('agreement'\)\.value=EXAMPLE_AGREEMENT;updateSourceCount/);
});
test('result is a separate phase with an explicit save before billing, no automatic PayPal action',()=>{
 assert.match(html,/STEP 2 OF 3 · AI FINDINGS/);
 assert.match(html,/STEP 3 OF 3 · SAVE YOUR REVIEW/);
 assert.match(html,/Save &amp; continue to billing review/);
 assert.match(js,/state\.analysis=data/);
 assert.match(js,/if\(state\.justSavedProject\)\{navigate\('payments'\);\}/);
 assert.match(css,/#ingestion\.has-analysis:not\(\.show-source\) #sourceEntry\{display:none!important\}/);
});
test('responsive, dark and reduced-motion presentation includes visible focus',()=>{
 for(const pattern of [/@media\(max-width:620px\)/,/@media\(max-width:940px\)/,/:root\[data-theme="dark"\] #ingestion/,/:focus-visible/,/@media\(prefers-reduced-motion:reduce\)/])assert.match(css,pattern);
});
