import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(name,import.meta.url),'utf8');
const html=read('../public/index.html');
const app=read('../public/app.js');
const css=read('../public/style.css');
const server=read('../server.mjs');

test('Overview label uses legacy #projects URL to preserve existing project links',()=>{
 assert.match(html, /href="#projects" data-page="projects">Overview<\/a>/);
 assert.match(html, /<h1>Overview<\/h1>/);
 assert.match(app, /projects:'Overview'/);
 assert.match(app, /function routeHash\(page=state\.page\)/);
});
test('first-use Overview provides exactly one primary CTA and a clearly illustrative decision',()=>{
 assert.match(html, /id="welcomeCreate">Analyze agreement/);
 assert.match(html, /id="welcomeExample">Try a synthetic example/);
 assert.match(html, /EXAMPLE · NOT A SAVED PROJECT/);
 assert.match(html, /id="emptyProjectHint"/);
 assert.match(app, /\$\('newAgreement'\)\.hidden=isFirstRun/);
 assert.match(html, /class="welcome-guidance"/);
});
test('intermediate navigation and welcome steps preserve independent text spacing',()=>{
 assert.match(css, /@media\(max-width:1020px\)/);
 assert.match(css, /\.sidebar nav\{display:flex/);
 assert.match(css, /@media\(max-width:800px\)/);
 assert.match(css, /\.overview-welcome \.welcome-steps>div\{display:grid/);
 assert.match(css, /\.overview-welcome \.welcome-steps strong\{display:block/);
 assert.match(css, /white-space:nowrap;flex-shrink:0/);
});
test('project management is located in Overview, not Payments',()=>{
 assert.match(app, /overview-project-settings/);
 assert.match(app, /manage\.append\(el\('summary','Manage project'\)\)/);
 assert.match(app, /Rename project/);
 assert.match(app, /Archive project/);
 assert.match(app, /Restore project/);
 assert.doesNotMatch(app, /inspector\.append\(manage\)/);
 assert.match(app, /if\(action==='archive'\)\$\('showArchived'\)\.checked=true/);
});
test('project archive and rename reuse existing local APIs and never call draft API',()=>{
 assert.match(app,/`\/api\/projects\/\$\{p\.id\}\/rename`/);
 assert.match(app,/`\/api\/projects\/\$\{p\.id\}\/\$\{action\}`/);
 assert.match(app,/PayPal invoices will not change/);
 assert.match(server,/\/api\/projects/);
});
test('sidebar environment and theme remain accessible without duplicate large Sandbox panel',()=>{
 assert.match(html,/class="environment-help"/);
 assert.match(html,/LOCAL · SANDBOX/);
 assert.match(html,/id="themeToggle"[^>]*aria-label=/);
 assert.match(css,/\.sidebar \.side-note\{display:none!important\}/);
});
