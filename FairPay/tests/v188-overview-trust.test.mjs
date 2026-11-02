import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleOverviewProjects,overviewInspectorId,projectNeedsReview} from '../public/overview-state.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const html=read('../public/index.html'),app=read('../public/app.js'),css=read('../public/style.css');
const fixture=[
 {id:'a',name:'Coral Studio',archivedAt:null,milestones:[{readiness:{code:'blocked'}}]},
 {id:'b',name:'Harbor Films',archivedAt:null,milestones:[{readiness:{code:'ready'}}]},
 {id:'c',name:'Archived North',archivedAt:'2026-01-01',milestones:[{readiness:{code:'draft'}}]},
];
test('v1.8.8 Overview filters exclude archived projects until explicitly requested',()=>{
 assert.deepEqual(visibleOverviewProjects(fixture).map(p=>p.id),['a','b']);
 assert.deepEqual(visibleOverviewProjects(fixture,{showArchived:true}).map(p=>p.id),['a','b','c']);
 assert.deepEqual(visibleOverviewProjects(fixture,{filter:'review'}).map(p=>p.id),['a']);
 assert.deepEqual(visibleOverviewProjects(fixture,{search:'HARBOR'}).map(p=>p.id),['b']);
 assert.deepEqual(visibleOverviewProjects(fixture,{search:'xyz'}),[]);
});
test('v1.8.8 filtered inspector cannot silently show an unrelated project',()=>{
 const visible=visibleOverviewProjects(fixture,{filter:'review'});
 assert.equal(overviewInspectorId(visible,'b'),'a');
 assert.equal(overviewInspectorId(visible,'a'),'a');
 assert.equal(overviewInspectorId([], 'b'),null);
 assert.equal(projectNeedsReview(fixture[0]),true);
 assert.equal(projectNeedsReview(fixture[1]),false);
});
test('v1.8.8 distinguishes loading, empty, error and stale cached data',()=>{
 for(const id of ['projectsLoadState','projectsLoadTitle','projectsLoadDescription','projectsRetry'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(html,/role="status" aria-live="polite"/);
 assert.match(app,/projectsLoadState:'loading'/);
 assert.match(app,/state\.projectsLoadState='error'/);
 assert.match(app,/state\.projectsLoadState='ready'/);
 assert.match(app,/state\.projectsLoadError=e\.message/);
 assert.match(app,/state\.loaded&&state\.projectsLoadState==='ready'&&!state\.projects\.length/);
 assert.match(app,/previously loaded information remains visible/i);
 assert.match(app,/Your local data has not been deleted/);
 assert.match(app,/\$\('projectsRetry'\)\.onclick=/);
});
test('v1.8.8 onboarding is explicitly synthetic and starts with a compact entry',()=>{
 assert.match(html,/id="welcomeExample"/);
 assert.match(html,/class="overview-demo"/);
 assert.match(html,/EXAMPLE · NOT A SAVED PROJECT/);
 assert.match(css,/\.overview-onboarding\{display:block!important\}/);
 assert.match(css,/\.overview-demo>summary/);
 assert.doesNotMatch(app,/function startExample\([\s\S]{0,200}\/drafts/);
});
test('v1.8.8 one-project overview defers secondary financial figures',()=>{
 assert.match(app,/metrics-compact/);
 assert.match(app,/metric-disclosure/);
 assert.match(app,/metrics\.slice\(0,2\)/);
 assert.match(app,/Previously selected project details are not shown outside the current filter/);
 assert.match(css,/\.metric-detail-grid/);
});

test('v1.8.8 overview browser module is available from backend',()=>{const server=read('../server.mjs');assert.match(server,/['"]\/overview-state\.mjs['"]:\s*['"]overview-state\.mjs['"]/);});
