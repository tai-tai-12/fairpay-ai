import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('Overview inspector wraps long underscore-separated project names without cropping',()=>{
 assert.match(css, /#projectDetail>h2\{[^}]*overflow-wrap:anywhere/);
 assert.match(css, /#projectDetail\{min-width:0/);
});
test('Singular project and payment milestone counts use the correct label',()=>{
 assert.match(app, /p\.milestones\.length===1\?'':'s'/);
 assert.match(app, /counts\.all===1\?'':'s'/);
});
