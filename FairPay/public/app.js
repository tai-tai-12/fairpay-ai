import {billingSummary, suggestProjectName, quotedAmounts, amountSourceMentions} from './analysis-ui.mjs';
import {paymentView,filterPaymentMilestones,paymentCounts,getSelectedMilestoneIndex} from './payment-view.mjs';
import {getBillingJourney} from './billing-journey.mjs';
import {workspaceProgress,readOnlyDecisionGuide,invoiceReviewPreview} from './trust-guide.mjs';
import {prepareFinancialReview,formatExactUsd} from './financial-review.mjs';
import {timelineEvents,safeAuditMarkdown} from './activity-view.mjs';
import {compareAgreementVersions} from './resolve-comparison.mjs';
import {visibleOverviewProjects,overviewInspectorId,projectNeedsReview} from './overview-state.mjs';
'use strict';
const $=id=>document.getElementById(id);
const state={projects:[],selected:null,index:0,filter:'all',analysis:null,page:'projects',busy:false,load:0,resolveText:{},loaded:false,projectsLoadState:'loading',projectsLoadError:'',paymentFilter:'all',paymentSearch:'',paymentMobileDetail:false,inspectorNotice:'',justSavedProject:null};
const CLEAR_EXAMPLE_AGREEMENT='Project: Synthetic Landing Page Design. Milestone 1: Deliver finalized landing page design files for the fixed agreed fee of USD 500. The fee becomes eligible for invoicing only after the client actually accepts the files. No payment, deposit, or credit has been verified by this agreement. Financial reconciliation, client acceptance and a separate exact-amount authorization are required before any Sandbox draft.';
const EXAMPLE_AGREEMENT='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork was originally priced at USD 600. A proposed unsigned amendment suggests USD 700, but the revised fee has not been confirmed. Client acceptance is required before billing.';
const EXAMPLE_RESOLVED_AGREEMENT='Project: Synthetic Coral Packaging Design. Milestone 1: Packaging artwork has a final agreed fee of USD 700, confirmed by both parties in a signed written amendment. The previous unsigned proposal is superseded. Actual client acceptance of the deliverable is required before any billing and has not yet been recorded.';
const money=(value,currency='USD')=>value==null?'Amount unresolved':`${currency} ${Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const project=()=>state.projects.find(p=>p.id===state.selected);
const needsReview=projectNeedsReview;
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
const button=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.onclick=()=>run(fn);return b;};
function message(text='',tone='info'){$('feedback').textContent=text;$('feedback').dataset.tone=tone;}
async function api(path,body){const r=await fetch(path,{signal:AbortSignal.timeout((path==='/api/analyze'||path.endsWith('/reanalyze'))?190000:65000),...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});let data;try{data=await r.json();}catch{throw Error(`Unexpected response (HTTP ${r.status}).`);}if(!r.ok)throw Error(data.error||`Request failed (${r.status}).`);return data;}
async function run(fn){try{await fn();}catch(e){message(e.message,'error');}}
async function mutate(fn){if(state.busy)return;state.busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}finally{state.busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);render();}}
function routeInfo(){const [page='projects',search='']=location.hash.slice(1).split('?');const params=new URLSearchParams(search);return {page,projectId:params.get('project'),milestoneId:params.get('milestone')};}
function routeHash(page=state.page){const q=new URLSearchParams();if(state.selected)q.set('project',state.selected);if(state.selectedMilestoneId)q.set('milestone',state.selectedMilestoneId);return `${page}${q.size?'?'+q:''}`;}
function syncRoute(){const target='#'+routeHash();if(location.hash!==target)history.replaceState(null,'',target);}
function navigate(page){if(state.busy)return;const target=routeHash(page);if(location.hash.slice(1)!==target)location.hash=target;else showPage();}
function showPage(focus=true){const previousPage=state.page;const route=routeInfo();state.page=['agreement','payments'].includes(route.page)?route.page:'projects';if(state.projects.length&&route.projectId){const target=state.projects.find(p=>p.id===route.projectId);if(target){state.selected=target.id;state.index=getSelectedMilestoneIndex(target,route.milestoneId,state.index);state.selectedMilestoneId=target.milestones[state.index]?.canonicalId||null;}}if(previousPage!==state.page)message('');for(const page of ['projects','agreement','payments']){$(`${page}Page`).hidden=page!==state.page;document.querySelector(`[data-page=${page}]`).toggleAttribute('aria-current',page===state.page);}document.querySelector('[aria-current]')?.setAttribute('aria-current','page');$('breadcrumb').textContent={projects:'Overview',agreement:'Agreements',payments:'Billing workspace'}[state.page];render();if(focus){window.scrollTo(0,0);$('main').focus();}}
async function reload(preferred=state.selected){
 const request=++state.load;const route=routeInfo();const milestoneId=state.selectedMilestoneId||route.milestoneId;
 state.projectsLoadState='loading';state.projectsLoadError='';renderProjects();
 message('Loading saved projects…');
 try{
  const data=await api('/api/projects');if(request!==state.load)return;
  if(!Array.isArray(data.projects))throw Error('Projects response is invalid.');
  state.projects=data.projects;state.loaded=true;state.projectsLoadState='ready';state.projectsLoadError='';
  state.selected=state.projects.some(p=>p.id===preferred)?preferred:state.projects.some(p=>p.id===route.projectId)?route.projectId:state.projects.find(p=>!p.archivedAt)?.id||state.projects[0]?.id||null;
  const current=project();
  if(milestoneId&&current?.milestones?.length&&!current.milestones.some(m=>m.canonicalId===milestoneId))state.inspectorNotice='Agreement updated: the current milestone selection has been refreshed.';
  else if(state.inspectorNotice.startsWith('The previously selected milestone')||state.inspectorNotice.startsWith('Agreement updated:'))state.inspectorNotice='';
  state.index=getSelectedMilestoneIndex(current,milestoneId,state.index);state.selectedMilestoneId=current?.milestones?.[state.index]?.canonicalId||null;
  syncRoute();message();render();
 }catch(e){
  if(request===state.load){state.projectsLoadState='error';state.projectsLoadError=e.message;
   message(`Could not load projects: ${e.message}. Your local data has not been deleted.`, 'error');render();}
  throw e;
 }
}
function choose(id){state.justSavedProject=null;state.selected=id;state.index=0;state.selectedMilestoneId=project()?.milestones?.[0]?.canonicalId||null;state.paymentMobileDetail=false;state.inspectorNotice='';state.paymentFilter='all';state.paymentSearch='';syncRoute();render();}
function status(m){return el('span',m.readiness.label,`status ${m.readiness.code}`);}
function billingCard(m,currency='USD'){
 const card=el('section','','billing-card');card.setAttribute('aria-label','Billing readiness for '+m.title);
 const heading=el('div','','billing-card-head');heading.append(el('strong',m.title),status(m));card.append(heading);
 const amt=el('div','','billing-amount');amt.append(el('small',m.amount!=null&&m.evidence_matched?'SOURCE-MATCHED AMOUNT · NOT AN INVOICE':'EFFECTIVE AMOUNT NOT VERIFIED'),el('strong',money(m.amount,currency)));card.append(amt);
 const reason=(m.financialRiskReasons||[])[0]||m.readiness.next;
 card.append(el('p',reason,'muted small'));
 const trace=el('small',`Evidence: ${m.evidence_matched?'matched':'not verified'} · Acceptance: ${m.approvalStatus==='approved'?'user-recorded':'not recorded'}`,'muted');card.append(trace);return card;
}

function renderGlobalJourney(){
 const target=$('globalJourney'),p=project(),m=p?.milestones?.[state.index]||p?.milestones?.[0];
 if(!p||!m){target.hidden=true;target.replaceChildren();return;}
 const progress=workspaceProgress(p,m);target.hidden=false;target.replaceChildren();
 const heading=el('div','','global-journey-head');heading.append(el('strong',`Your next step: ${progress.label}`),el('span',`${progress.completed} of 4 recorded stages · ${p.name}`,'global-journey-count'));target.append(heading);
 const items=el('ol','','global-journey-steps');for(const step of progress.stages){const n=el('li','','global-stage '+(step.done?'done':step.id===progress.current?'current':''));n.append(el('span',step.done?'✓':'○','global-stage-icon'),el('span',step.label));if(!step.done&&step.id===progress.current)n.setAttribute('aria-current','step');items.append(n);}target.append(items);
 target.append(el('p',progress.invoice?'Existing invoice tracked. DRAFT is not sent or paid. Never create another draft.':'Local user records are not bank verification. Invoice creation requires a separate confirmation.','global-journey-note'));
}
function render(){const p=project();$('currentContext').textContent=p?`${p.name} · ${p.milestones[state.index]?.title||'Milestone not selected'}`:'';renderProjects();renderReview();renderPayments();renderResolve();renderGlobalJourney();}
function renderProjects(){
 const active=state.projects.filter(p=>!p.archivedAt),review=active.filter(needsReview);
 const firstLoadPending=!state.loaded;
 const isFirstRun=state.loaded&&state.projectsLoadState==='ready'&&!state.projects.length;
 const indicator=$('projectsLoadState');indicator.hidden=state.projectsLoadState==='ready';
 if(!indicator.hidden){
  const loading=state.projectsLoadState==='loading';
  $('projectsLoadTitle').textContent=loading?'Loading your projects…':state.loaded?'Could not refresh projects':'Could not load your projects';
  $('projectsLoadDescription').textContent=loading?(state.loaded?'Refreshing saved projects. Previously loaded information remains visible until the request completes.':'Checking local project records. Do not assume there are no projects yet.'):(state.loaded?'Showing last loaded information. It may be outdated; retry before trusting current statuses.':'Your project records have not been confirmed as empty or lost. Check the local server and try again.');
  $('projectsRetry').hidden=loading;
 }
 $('projectsWelcome').hidden=!isFirstRun;$('emptyProjectHint').hidden=!isFirstRun;
 $('newAgreement').hidden=isFirstRun||firstLoadPending;
 $('dashboardSummary').hidden=isFirstRun||firstLoadPending;
 $('reviewQueueSection').hidden=isFirstRun||firstLoadPending||review.length===0;
 $('reviewQueueSection').classList.toggle('single-project-queue',active.length===1);
 $('projectsWorkspace').hidden=isFirstRun||firstLoadPending;
 const metrics=[
 ['Active projects',active.length,'Locally saved, not archived'],
 ['Need review',review.length,'Projects requiring a decision'],
 ['Known source amounts',active.length&&active.every(p=>p.milestones.every(m=>m.amount==null))?'Amount unresolved':money(active.filter(p=>p.currency==='USD').reduce((sum,p)=>sum+(p.summary?.contractValueCents||0),0)/100),'Excludes unknown fees · not revenue'],
 ['PayPal-confirmed paid',active.some(p=>p.summary?.paidAmountUnknownCount)?'Amount unverified':money(active.reduce((sum,p)=>sum+(p.summary?.confirmedPaidCents||0),0)/100),'Last stored PayPal read-back']
 ];
 const metricNode=([label,value,note])=>{const n=el('div','','metric');n.append(el('span',label),el('strong',value),el('small',note));return n;};
 const metricsBox=$('metrics');metricsBox.classList.toggle('metrics-compact',active.length<=1);
 if(active.length<=1){
  const more=el('details','','metric-disclosure');more.append(el('summary','Financial figures · expand for details'));
  const inner=el('div','','metric-detail-grid');inner.append(...metrics.slice(2).map(metricNode));more.append(inner);
  metricsBox.replaceChildren(...metrics.slice(0,2).map(metricNode),more);
 }else metricsBox.replaceChildren(...metrics.map(metricNode));
 $('queueTitle').textContent=`${review.length} project${review.length===1?' needs':'s need'} a decision`;
 $('queue').replaceChildren(...review.slice(0,2).map(p=>{
  const m=p.milestones.find(m=>['blocked','amendment','unknown','uncertain','reconcile'].includes(m.readiness.code));
  const b=button(active.length===1?'Review issue →':m.readiness.next,()=>{choose(p.id);$('projectDetail').scrollIntoView({block:'nearest'});$('projectDetail').querySelector('summary')?.focus();});b.append(el('small',p.name));return b;
 }));
 const visible=visibleOverviewProjects(state.projects,{showArchived:$('showArchived').checked,search:$('search').value,filter:state.filter});
 if(state.loaded&&state.page==='projects'){
  const next=overviewInspectorId(visible,state.selected);
  if(next&&next!==state.selected){state.selected=next;state.index=0;state.selectedMilestoneId=project()?.milestones?.[0]?.canonicalId||null;state.paymentMobileDetail=false;syncRoute();$('currentContext').textContent=project()?`${project().name} · ${project().milestones[state.index]?.title||'Milestone not selected'}`:'';}
 }
 $('projectList').replaceChildren(...visible.map(p=>{const b=button('',()=>choose(p.id),'project-row');b.setAttribute('aria-pressed',String(p.id===state.selected));const left=el('span');left.append(el('strong',p.name),el('small',`${p.milestones.length} milestone${p.milestones.length===1?'':'s'}${p.archivedAt?' · Archived':''}`));const right=el('span');right.append(el('strong',p.milestones.every(m=>m.amount==null)?'Amount unresolved':money(p.summary.contractValueCents/100,p.currency)),el('small',needsReview(p)?'Needs review':'See milestone states'));b.append(left,right);return b;}));if(!visible.length)$('projectList').append(el('p',state.projects.length?'No matching projects. Change your search or filters.':'No saved projects yet. Start with New agreement.','empty'));
const panel=$('projectDetail');panel.replaceChildren();const p=visible.find(p=>p.id===state.selected);if(!p){panel.append(el('h2',state.loaded?'No matching project selected':'Projects not loaded'),el('p',state.loaded?'Adjust the search or filters to choose a project. Previously selected project details are not shown outside the current filter.':'Load project records before viewing saved evidence.','muted'));return;}panel.append(el('p','PROJECT DETAILS','eyebrow'),el('h2',p.name));
 if(p.archivedAt)panel.append(el('span','Archived · Read-only until restored','status unknown'));
 const manage=el('details','','overview-project-settings');manage.append(el('summary','Manage project'));
 const manageActions=el('div','','project-manage-actions');
 manageActions.append(button('Rename project',async()=>{const name=prompt('Project name',p.name);if(name===null)return;await mutate(async()=>{await api(`/api/projects/${p.id}/rename`,{name});await reload(p.id);message('Project renamed. Invoice records have not changed.','success');});}));
 manageActions.append(button(p.archivedAt?'Restore project':'Archive project',async()=>{const action=p.archivedAt?'restore':'archive';if(!confirm(`${action==='archive'?'Archive':'Restore'} ${p.name}? This changes local visibility only; PayPal invoices will not change.`))return;await mutate(async()=>{await api(`/api/projects/${p.id}/${action}`,{});if(action==='archive')$('showArchived').checked=true;await reload(p.id);message(`Project ${action==='archive'?'archived':'restored'}. PayPal invoices were not changed.`,'success');});}));
 manage.append(manageActions);panel.append(manage);const action=el('div','Loading server recommendations…','callout');panel.append(action);const current=p.id;api(`/api/projects/${p.id}/actions`).then(data=>{if(project()?.id!==current||!action.isConnected)return;action.replaceChildren(el('strong',data.actions[0]?.title||'No milestone actions'),el('p',data.actions[0]?.reason||''));}).catch(e=>{if(action.isConnected)action.textContent=`Recommendations unavailable: ${e.message}`;});const details=el('details');details.append(el('summary','Why this recommendation?'));for(const m of p.milestones){details.append(el('blockquote',m.source_excerpt||'Source evidence unavailable'),el('p',(m.financialRiskReasons||[]).join(' ')||m.readiness.next));}panel.append(details);if(p.milestones[0])panel.append(billingCard(p.milestones[0],p.currency));if(p.milestones.length>1){const more=el('details','','project-milestones');more.append(el('summary',`View all ${p.milestones.length} milestones`));for(const m of p.milestones){const n=el('div','','project-milestone-row');n.append(el('strong',m.title),el('span',money(m.amount,p.currency)),status(m));more.append(n);}panel.append(more);}panel.append(renderActivity(p,true));panel.append(button('View agreement & evidence →',()=>navigate('agreement')),button('↓ Download project summary',()=>downloadMarkdown(projectReport(p),`FairPay-project-${p.name}`)));}
// dev.8.3 - Client-side entry method selection; never changes financial permissions.
function setSourceMethod(mode, focusTab=false){
 const isPaste=mode!=='upload';
 for(const [id,active] of [['pasteMethodTab',isPaste],['uploadMethodTab',!isPaste]]){
  const tab=$(id);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.classList.toggle('is-selected',active);
 }
 $('pastePanel').hidden=!isPaste;$('uploadPanel').hidden=isPaste;
 if(focusTab)$(isPaste?'pasteMethodTab':'uploadMethodTab').focus();
}
function updateSourceCount(){const count=$('agreement').value.length;$('sourceCharacterCount').textContent=`${count.toLocaleString()} / 12,000 characters`;}
for(const [id,mode] of [['pasteMethodTab','paste'],['uploadMethodTab','upload']]){
 $(id).onclick=()=>setSourceMethod(mode);
 $(id).addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();setSourceMethod(e.key==='Home'?'paste':e.key==='End'?'upload':mode==='paste'?'upload':'paste',true);}});
}
function newAgreement(){$('agreementPage').classList.remove('result-mode');setAnalysisProgress(false);state.selected=null;state.selectedMilestoneId=null;state.analysis=null;state.justSavedProject=null;$('analysisResult').hidden=true;$('ingestion').classList.remove('has-analysis','show-source');$('agreement').value='';$('importReceipt').hidden=true;$('documentDropZone').removeAttribute('data-state');$('documentStatus').textContent='File text stays on this local workspace. Nothing is analyzed or saved until you choose to proceed.';$('projectName').value='';$('persistEvidence').checked=false;setSourceMethod('paste');updateSourceCount();navigate('agreement');renderReview();$('agreement').focus();}
function startExample(){newAgreement();$('agreement').value=EXAMPLE_AGREEMENT;updateSourceCount();message('Conflicting-fee synthetic contract loaded. Analyze only with local AI; no credit, acceptance, project or invoice was recorded.');$('agreement').focus();}
function startClearExample(){newAgreement();loadExample(CLEAR_EXAMPLE_AGREEMENT,'Clear-fee');}
function loadExample(text,kind){setSourceMethod('paste');$('agreement').value=text;$('agreement').dispatchEvent(new Event('input',{bubbles:true}));message(`${kind} synthetic contract loaded for review. Analyze only if local AI is available; no credit, acceptance, project or invoice was recorded.`);$('agreement').focus();}
function selectors(){for(const id of ['reviewProject','paymentProject']){const s=$(id);s.replaceChildren(...state.projects.map(p=>{const o=el('option',p.name+(p.archivedAt?' · Archived':''));o.value=p.id;return o;}));s.value=state.selected||'';s.disabled=!state.projects.length;}}
function highlightedExcerpt(text,amount,currency){
 const quote=el('blockquote','','highlighted-source');const source=String(text||'');
 if(amount==null||!Number.isFinite(Number(amount))||!source){quote.textContent=source;return quote;}
 const raw=Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
 const variants=[raw,raw.replace(/,/g,''),Number(amount).toString()];
 let found=null;for(const v of variants){const at=source.indexOf(v);if(at>=0){found={at,raw:v};break;}}
 if(!found){quote.textContent=source;return quote;}
 quote.append(document.createTextNode(source.slice(0,found.at)),el('mark',found.raw),document.createTextNode(source.slice(found.at+found.raw.length)));
 return quote;
}
function renderReview(){selectors();const p=project();$('ingestion').hidden=!!p;$('agreementReview').hidden=!p;if(!p)return;const m=p.milestones[state.index]||p.milestones[0];if(!m)return;
 const saved=$('savedNextAction');saved.hidden=state.justSavedProject!==p.id;saved.replaceChildren();
 if(!saved.hidden){saved.append(el('strong','Saved for review · No invoice created'),el('p',`${p.name} · ${m.title} · ${m.readiness.label}. ${m.readiness.next}`));
  saved.append(button('Review source & resolve →',()=>{$('sourceEvidence').scrollIntoView({block:'center'});$('sourceEvidence').focus();}),button('Payment operations →',()=>navigate('payments')));}
 const currentSource=p.agreementVersions?.find(v=>v.id===p.agreementVersionId)?.sourceText;
 $('sourceAvailability').textContent=currentSource?'Current agreement version saved locally. Quoted amounts below are literal source mentions, NOT authorized fees.':'Evidence incomplete — full agreement source was not saved. Partial excerpts cannot prove the controlling fee. Re-supply full agreement and re-analyze.';
 $('sourceEvidence').replaceChildren();
 if(currentSource){const mentions=amountSourceMentions(currentSource,8);if(mentions.length){
  const block=el('div','','agreement-amount-evidence');block.append(el('strong','Source-quoted fee mentions · not invoice authorization'));
  for(const mention of mentions){const item=el('div','','evidence-row');item.append(el('strong',mention.label),el('blockquote',mention.excerpt));block.append(item);}
  if(p.milestones.length>1)block.append(el('p','Agreement-wide source mentions; check which clause belongs to the selected milestone.','small muted'));
  $('sourceEvidence').append(block);
 }else $('sourceEvidence').append(el('p','No literal supported USD amount mentions found.','callout'));}
 else {$('sourceEvidence').append(el('p','Evidence incomplete — original agreement and amendments are unavailable in this saved project.','callout'),el('blockquote',m.source_excerpt||'No excerpt available.'));}
 if(m.source_excerpt){const excerptBox=el('div','','current-milestone-evidence');excerptBox.append(el('strong','Selected milestone · source excerpt'),highlightedExcerpt(m.source_excerpt,m.amount,p.currency),el('p','Highlight shows the saved quoted number, not a payment authorization.','small muted'));$('sourceEvidence').append(excerptBox);}
 $('sourceEvidence').tabIndex=-1;$('milestoneList').replaceChildren(...p.milestones.map((item,i)=>{const b=button(`${i+1}. ${item.title} · ${money(item.amount,p.currency)}`,()=>{state.index=i;state.selectedMilestoneId=item.canonicalId;syncRoute();renderReview();renderResolve();});b.className='milestone-choice';b.setAttribute('aria-pressed',String(item===m));return b;}));const d=$('decision');d.replaceChildren(el('p','FINANCIAL POLICY / HUMAN REVIEW','eyebrow'),el('h2','Decision & next action'),billingCard(m,p.currency),agreementBalance(p,m),el('p',m.amount?'The contract fee is not the amount to invoice. Financial review and authorization are separate.':'Effective billable amount is not verified. Clarify the source before invoicing.','muted'));d.append(el('p',m.readiness.next,'callout'));for(const reason of m.financialRiskReasons||[])d.append(el('p',reason));if(m.financialRiskCodes?.length)d.append(el('p',m.financialRiskCodes.join(' · '),'small')); d.append(el('small',`Policy version: ${m.financialPolicyVersion??'unavailable'} · Evidence matched: ${m.evidence_matched?'yes':'no'}`));d.append(button('View source',()=>{$('sourceEvidence').focus();$('sourceEvidence').scrollIntoView({block:'center'});}));d.append(el('p',`Client acceptance: ${m.approvalStatus==='approved'?'user-confirmed (not authenticated by FairPay)':'not recorded'}`));if(!p.archivedAt&&!m.invoices.length&&!['blocked','uncertain','unknown'].includes(m.readiness.code)){d.append(button(m.approvalStatus==='approved'?'Review recorded acceptance in Billing →':'Continue to billing steps →',()=>navigate('payments')));if(m.amount_verification==='amendment_review')d.append(button(m.amendmentConfirmed?'Revoke amendment confirmation':'Confirm controlling amendment',async()=>{if(!m.amendmentConfirmed&&!confirm('Have you reviewed the controlling amendment and confirmed this revised fee?'))return;await mutate(async()=>{await api(`/api/projects/${p.id}/milestones/${m.index}/amendment`,{confirmed:!m.amendmentConfirmed,agreementVersionId:p.agreementVersionId});await reload(p.id);});}));}if((p.agreementVersions||[]).length>=2)d.append(button('Compare saved decisions ↓',()=>{const target=document.querySelector('#resolve .resolve-comparison');if(target){target.scrollIntoView({block:'start',behavior:'smooth'});target.focus({preventScroll:true});}}));d.append(button('Open billing workspace →',()=>navigate('payments')));d.append(renderDecisionGuide(p,m));if(p.archivedAt)d.append(el('p','Archived project. Restore it from Overview before changing approvals.','callout'));}
function agreementBalance(p,m){
 const box=el('div','','agreement-balance');
 const j=getBillingJourney(p,m);const row=j.row;
 if(row){
  for(const [name,value] of [['Contract fee',money(row.grossMinor/100,p.currency)],['Recorded credits','− '+money(row.creditedMinor/100,p.currency)],['Net outstanding',money(row.outstandingMinor/100,p.currency)]]){
   const item=el('div','','agreement-balance-item');item.append(el('span',name),el('strong',value));box.append(item);
  }
  box.append(el('p','Outstanding is a human-recorded estimate, not bank-verified or automatically authorized.','small muted'));
 }else box.append(el('p','Financial review not yet completed. The source amount above is not a verified receivable.','small muted'));
 return box;
}
async function recordAcceptance(p,m){
 if(m.invoices?.length)throw Error('An invoice already exists. Acceptance cannot be changed from this workflow.');
 const approved=m.approvalStatus!=='approved';
 if(approved&&!confirm('For this local record: confirm that the client actually accepted this deliverable. This is not authenticated by FairPay. No PayPal action will occur.'))return;
 await mutate(async()=>{
  await api(`/api/projects/${p.id}/milestones/${m.index}/approval`,{status:approved?'approved':'pending',agreementVersionId:p.agreementVersionId});
  await reload(p.id);
  message('Acceptance record updated locally. No PayPal invoice was created.','success');
 });
}
function renderPaymentJourney(p,m,vm){
 const j=getBillingJourney(p,m);const wrapper=el('section','','billing-journey');wrapper.setAttribute('aria-label','Billing workflow and next step');
 wrapper.append(el('p','YOUR BILLING WORKFLOW','eyebrow'));
 const heading=el('div','','journey-title');heading.append(el('h3',j.invoice?'Sandbox draft saved':'Complete this milestone in order'),el('span',j.invoice?.status==='DRAFT'?'DRAFT · NOT SENT':j.invoice?'Existing invoice':'LOCAL · SANDBOX','journey-tag'));wrapper.append(heading);
 const moneybox=el('div','','journey-amounts');
 const facts=[[j.row?'Contract gross · local ledger':'Source fee · not reconciled',j.row?money(j.grossMinor/100,p.currency):money(m.amount,p.currency)],['Recorded credits · not bank-verified',j.row?`− ${money(j.creditedMinor/100,p.currency)}`:'Not reviewed'],[j.invoice?'Existing invoice total · last stored':'Net outstanding · local estimate',j.invoice?.total?money(j.invoice.total.value,j.invoice.total.currency):j.row?money(j.amountMinor/100,p.currency):'Pending review']];
 for(const [label,val] of facts){const item=el('div','','journey-amount');item.append(el('span',label),el('strong',val));moneybox.append(item);}
 wrapper.append(moneybox);
 // Financial eligibility and external PayPal status are separate truth domains.
 // Neither an AI/source match nor a user-recorded ledger is a PayPal payment.
 const track=el('div','','journey-trust-tracks');
 const local=el('div','','journey-trust-track');
 local.append(el('strong','Billing eligibility · local review'),el('p',
   !j.source?'Source amount needs verification':!j.ledger?'Financial review not recorded':!j.accepted?'Acceptance not recorded':
   'Source, human-recorded ledger and user-recorded acceptance are present. These are not independently verified buyer approvals.'));
 const external=el('div','','journey-trust-track external');
 external.append(el('strong','PayPal invoice · Sandbox read-back'),el('p',j.invoice?
   `${vm.invoiceLabel} · Last verified: ${j.invoice.lastVerifiedAt?new Date(j.invoice.lastVerifiedAt).toLocaleString():'Not verified by provider'}. No bank settlement implied.`:
   (m.creationState?'Creation outcome uncertain; inspect Sandbox before any retry.':'No PayPal invoice created; no payment was collected.')));
 track.append(local,external);wrapper.append(track);
 const steps=el('ol','','journey-steps');for(const step of j.stages){const li=el('li','','journey-step '+(step.done?'complete':step.id===j.next?'current':'future'));li.append(el('span',step.done?'✓':String(j.stages.indexOf(step)+1),'journey-index'),el('span',step.label));steps.append(li);}wrapper.append(steps);
 const next=el('div','','journey-next');next.append(el('strong',j.next==='draft-review'?'Next: review your unsent draft in the Sandbox':j.next==='status-review'?'Next: reconcile the last known PayPal status':j.next==='paid'?'Last-known payment state (verify externally)':j.next==='source'?'Next: verify agreement evidence':j.next==='ledger'?'Next: record financial reconciliation':j.next==='acceptance'?'Next: record client acceptance':'Next: review and authorize one draft'));
 if(j.invoice){next.append(el('p',`Invoice ID: ${j.invoice.invoiceId||'Not returned'} · Last read-back: ${j.invoice.lastVerifiedAt?new Date(j.invoice.lastVerifiedAt).toLocaleString():'Not verified'}`,'journey-invoice-meta'));}
 const desc={
 'draft-review':'One draft is stored. Do not create another or assume it was sent or paid. Verify the latest read-back.',
 'status-review':'An existing invoice needs status verification. Never retry creation while the outcome is uncertain.',
 paid:'A last-known PAID status is not a live bank settlement confirmation.',
 source:'The source fee is unverified. Edit or re-analyze the contract before financial review.',
 ledger:'Verify deposits and past payments before any invoice authorization.',
 acceptance:'Record actual client acceptance separately. This is a local user attestation, not client authentication.',
 draft:'Confirm exact net amount, Sandbox recipient and ledger revision before a single draft request.'
 };next.append(el('p',desc[j.next],'small muted'));
 if(j.next==='source')next.append(button('Review contract evidence →',()=>navigate('agreement')));
 if(j.next==='ledger')next.append(button('Open financial review ↓',()=>{const panel=document.querySelector('.financial-review-panel');if(!panel){message('Financial review is unavailable until the agreement has a supported verified amount.','error');return;}panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('summary')?.focus({preventScroll:true});}));
 if(j.next==='acceptance'&&!p.archivedAt&&!m.invoices?.length)next.append(button('Record client acceptance',()=>recordAcceptance(p,m)));
 if(j.next==='draft')next.append(button('Review draft authorization ↓',()=>{const form=document.querySelector('.payment-draft-form');if(form){form.scrollIntoView({behavior:'smooth',block:'center'});form.querySelector('input')?.focus({preventScroll:true});}}));
 if(j.invoice)next.append(button('See existing invoice & status controls ↓',()=>{const details=document.querySelector('.payment-invoice-details');if(details){details.open=true;details.scrollIntoView({behavior:'smooth',block:'center'});details.querySelector('summary')?.focus({preventScroll:true});}}));
 wrapper.append(next);
 wrapper.append(renderDecisionGuide(p,m));wrapper.append(el('p','Evidence and human review are separate. DRAFT ≠ SENT ≠ PAID. FairPay never sends invoices automatically.','journey-disclaimer'));
 return wrapper;
}
function renderDecisionGuide(p,m){
 const data=readOnlyDecisionGuide(p,m);const details=el('details','','decision-guide');details.setAttribute('aria-label','Explain this decision');details.append(el('summary','Why this decision? · Read-only guide'));
 const summary=el('p',data.summary,'guide-summary');details.append(summary);
 for(const q of data.questions){const item=el('details','','guide-question');item.append(el('summary',q.label),el('p',q.answer),el('blockquote',q.source));details.append(item);}
 details.append(el('p','Uses saved contract evidence and the current stored policy and ledger state. Not independent legal review, bank verification, or permission to invoice.','guide-disclaimer'));
 return details;
}
function renderInvoicePreview(p,m){
 const preview=invoiceReviewPreview(p,m);if(!preview)return null;
 const box=el('section','','invoice-review-preview');box.setAttribute('aria-label','Invoice review preview');box.append(el('p','INVOICE PREVIEW · READ ONLY','eyebrow'),el('h3',preview.existing?'Existing Sandbox invoice':'Before you authorize a draft'));
 const val=el('strong',preview.amount,'invoice-preview-amount');box.append(val);
 if(!preview.existing){const grid=el('dl','','invoice-preview-facts');for(const [k,v] of [['Contract gross',preview.gross],['Recorded credits',preview.credits],['Recipient',preview.recipient]]){const row=el('div');row.append(el('dt',k),el('dd',v));grid.append(row);}box.append(grid);}
 box.append(el('p',preview.note,'small muted'));
 if(preview.ledgerId)box.append(el('p',`Ledger revision: ${preview.ledgerId}`,'guide-ledger'));
 return box;
}
function renderPayments(){
 const area=$('payments');area.replaceChildren();
 const p=project();$('paymentsWelcome').hidden=!!p;$('paymentsWorkspace').hidden=!p;
 if(!p){$('paymentOverview').replaceChildren();return;}
 const counts=paymentCounts(p.milestones);
 $('paymentOverview').replaceChildren();
 state.index=getSelectedMilestoneIndex(p,state.selectedMilestoneId,state.index);
 const selected=p.milestones[state.index];state.selectedMilestoneId=selected?.canonicalId||null;
 const grid=el('div','','payments-console');
 const queue=el('section','','surface payment-queue');queue.setAttribute('aria-label','Milestone work queue');
 queue.append(el('p','PAYMENT OPERATIONS','eyebrow'),el('h2','Milestone queue'));
 queue.append(el('p',`${counts.all} milestone${counts.all===1?'':'s'} · ${counts.attention} need review · ${counts.ready} ready to draft`,'muted queue-intro'));
 const tools=el('div','','payment-tools');const searchLabel=el('label','Find milestone');const search=el('input');search.type='search';search.placeholder='Search milestones';search.value=state.paymentSearch;search.setAttribute('aria-label','Search milestone queue');
 const filters=el('div','','payment-filters');filters.setAttribute('role','group');filters.setAttribute('aria-label','Filter milestones by state');
 for(const [value,label] of [['all','All'],['attention','Needs review'],['pending','Acceptance'],['ready','Ready'],['invoiced','Invoices'],['paid','Paid']]){
  const n=button(`${label} (${counts[value]})`,()=>{state.paymentFilter=value;state.paymentMobileDetail=false;renderPayments();},'secondary payment-filter');n.setAttribute('aria-pressed',String(value===state.paymentFilter));filters.append(n);
 }
 tools.append(searchLabel,search,filters);queue.append(tools);
 const rows=el('div','','payment-queue-rows');rows.setAttribute('aria-label','Milestones');queue.append(rows);
 const inspector=el('section','','surface payment-inspector');inspector.id='paymentInspector';inspector.setAttribute('aria-label','Selected milestone details');
 const list=()=>{
  const matches=filterPaymentMilestones(p.milestones,state.paymentFilter,state.paymentSearch);
  rows.replaceChildren();
  if(!matches.length){rows.append(el('p','No milestones match. Choose another filter or search.','empty'));return;}
  for(const m of matches){const v=paymentView(m);const b=button('',()=>{
   state.index=m.index;state.selectedMilestoneId=m.canonicalId;state.paymentMobileDetail=true;state.inspectorNotice='';syncRoute();renderReview();renderPayments();
   const target=$('paymentInspectorTitle');if(target){target.focus({preventScroll:true});if(window.matchMedia('(max-width: 760px)').matches)target.scrollIntoView({behavior:'smooth',block:'start'});}
  },'payment-queue-row');b.dataset.milestoneId=m.canonicalId;b.setAttribute('aria-pressed',String(m.canonicalId===state.selectedMilestoneId));
  const header=el('span','','payment-row-main');header.append(el('strong',m.title),el('small',`Milestone ${m.index+1} · ${m.amount==null?'Amount unresolved':money(m.amount,p.currency)}`));
  const chip=el('span',v.label,`payment-chip ${v.tone}`);b.append(header,chip);rows.append(b);}
 };
 search.oninput=()=>{state.paymentSearch=search.value;list();};list();
 const back=button('← Back to milestones',()=>{state.paymentMobileDetail=false;renderPayments();const target=$('payments').querySelector(`[data-milestone-id="${state.selectedMilestoneId}"]`);target?.focus();target?.scrollIntoView({block:'nearest'});},'secondary payment-mobile-back');inspector.append(back);
 if(!selected){inspector.append(el('h2','Choose a milestone'));grid.append(queue,inspector);area.append(grid);return;}
 const vm=paymentView(selected);inspector.append(renderPaymentJourney(p,selected,vm));const head=el('div','','payment-inspector-head');const title=el('h2',selected.title);title.id='paymentInspectorTitle';title.tabIndex=-1;const chip=el('span',vm.label,`payment-chip ${vm.tone}`);head.append(title,chip);inspector.append(el('p',`MILESTONE ${selected.index+1} / ${p.milestones.length} · ${p.name}`,'eyebrow'),head);
 inspector.append(el('p',vm.next,'payment-next-action'));
 const facts=el('dl','','payment-facts');
 const fact=(term,detail)=>{const n=el('div','','payment-fact');n.append(el('dt',term),el('dd',detail));facts.append(n);};
 fact('Amount in agreement',selected.amount==null?'Not verified':money(selected.amount,p.currency));
 fact('Outstanding receivable',p.receivable?.status==='HUMAN_RECORDED'?money(p.receivable.milestones.find(r=>r.milestoneId===selected.canonicalId)?.outstandingMinor/100,p.currency)+' · human-recorded, not bank-verified':'Unknown · source amount is not debt verification');
 fact('Financial reconciliation',p.receivable?.reason||'Not recorded');
 fact('Source evidence',vm.sourceLabel);
 fact('Billing eligibility · local policy',vm.policyLabel);
 fact('Client acceptance',vm.acceptanceLabel);
 fact('PayPal invoice · external status',vm.invoiceLabel);
 if(vm.invoice)fact('Status provenance',`Last stored PayPal read-back: ${vm.lastVerified?new Date(vm.lastVerified).toLocaleString():'Never verified'}${vm.invoice.status==='PAID'?' · Not a live balance':''}`);
 const audit=el('details','','payment-audit-details');audit.append(el('summary','Detailed amounts, evidence & policy status'),facts);inspector.append(audit);
 const actionNotice=el('div',state.inspectorNotice||'','payment-action-notice');actionNotice.setAttribute('role','status');actionNotice.setAttribute('aria-live','polite');inspector.append(actionNotice);
 // Financial-review workflow is intentionally available before approval, but
 // saving it invalidates prior acceptance and does not authorize a draft.
 if(p.receivableLedger){
  const current=p.receivable?.status==='HUMAN_RECORDED';
  const note=el('section','','financial-ledger-saved');note.setAttribute('aria-label','Recorded financial review');
  note.append(el('h3',current?'Financial review recorded':'Financial review needs renewal'),
    el('p',`Review reference: ${p.receivableLedger.confirmation?.reference||'Unavailable'}`,'small'),
    el('p',`Revision: ${p.receivableLedger.id||'Unavailable'} · Recorded: ${p.receivableLedger.at||'Unknown time'}`,'small muted'));
  if(p.receivable?.status==='HUMAN_RECORDED'){
   const r=p.receivable;
   note.append(el('p',`Contract ${formatExactUsd(r.grossMinor)} USD − recorded credits ${formatExactUsd(r.creditedMinor)} USD = outstanding ${formatExactUsd(r.outstandingMinor)} USD`,'ledger-total'));
   if(r.creditedMinor>0)note.append(el('p','Prior credits reduce the authorized draft amount. An exact net amount and current ledger revision must be confirmed again at draft creation. These balances are human-recorded, not bank-verified.','payment-alert'));
   if(p.receivableLedger.credits?.length){const items=el('details','','ledger-credit-disclosure');items.append(el('summary',`View ${p.receivableLedger.credits.length} credit / payment evidence record(s)`));for(const c of p.receivableLedger.credits){const scope=c.allocations?.map(a=>p.milestones.find(m=>m.canonicalId===a.milestoneId)?.title||'Unknown milestone').join(', ')||'No allocation';items.append(el('p',`${c.kind} · ${c.amount} ${c.currency} · ${scope} · reference: ${c.reference||'No reference recorded'}`,'small'));}note.append(items);}
   else note.append(el('p','No credits recorded. New acceptance and a separate draft authorization are required.','small muted'));
  }else note.append(el('p','The review no longer matches the source or current policy. Re-analyze and reconcile before billing.','payment-alert'));
  inspector.append(note);
 }
 if(p.agreementVersionId&&!p.archivedAt&&!p.pendingAnalysis&&!p.milestones.some(m=>m.invoices.length||m.creationState||m.reanalysisRequired)&&p.currency==='USD'&&p.milestones.every(m=>m.amount&&m.source_excerpt?.length<=400)&&(!p.receivableLedger||(p.receivable?.status!=='HUMAN_RECORDED'&&!p.receivableLedger.credits?.length))){
  const needsRenewal=Boolean(p.receivableLedger);
  const reconcile=el('details','','financial-review-panel');reconcile.append(el('summary',needsRenewal?'Renew financial review after source / policy change':'Step 1 · Record financial reconciliation'));
  reconcile.append(el('p','Review every milestone against your accounting records. Record all prior payments, deposits, retainers and credits with references. No payment is independently verified and no invoice is authorized.','small muted'));
  const form=el('form','','financial-review-form');const note=el('input'),label=el('label','Accounting review reference');
  note.required=true;note.minLength=8;note.maxLength=400;note.placeholder='e.g. Synthetic accounting check 2026-10-16';label.append(note);form.append(label);
  const ledgerList=el('div','','ledger-credit-list');const add=button('＋ Add deposit / credit',()=>{
   if(ledgerList.children.length>=12){message('The form supports at most 12 credit records.','error');return;}
   const row=el('fieldset','','ledger-credit-row');row.dataset.creditId=crypto.randomUUID();
   const legend=el('legend',`Credit record ${ledgerList.children.length+1}`);row.append(legend);
   const kind=el('select');for(const [value,text] of [['deposit','Paid deposit'],['retainer','Retainer'],['partial_payment','Partial payment'],['credit','Credit note'],['offset','Other documented offset']]){const op=el('option',text);op.value=value;kind.append(op);}
   const kindLabel=el('label','Credit type');kindLabel.append(kind);
   const target=el('select');for(const m of p.milestones){const op=el('option',m.title);op.value=m.canonicalId;target.append(op);}target.value=selected.canonicalId;
   const targetLabel=el('label','Apply against milestone');targetLabel.append(target);
   const amount=el('input');amount.type='text';amount.inputMode='decimal';amount.placeholder='0.00';amount.required=true;amount.pattern='(?:0|[1-9][0-9]{0,7})(?:\\.[0-9]{1,2})?';
   const amountLabel=el('label','Credit amount (USD)');amountLabel.append(amount);
   const ref=el('input');ref.required=true;ref.minLength=8;ref.maxLength=400;ref.placeholder='Synthetic receipt or credit-note ID';
   const refLabel=el('label','Evidence / receipt reference');refLabel.append(ref);
   const remove=button('Remove credit',()=>{row.remove();updateTotals();},'secondary');
   row.append(kindLabel,targetLabel,amountLabel,refLabel,remove);
   row._creditFields={kind,target,amount,ref};amount.addEventListener('input',updateTotals);target.addEventListener('change',updateTotals);
   ledgerList.append(row);updateTotals();amount.focus();
  },'secondary');
  const totals=el('p','','ledger-total');totals.setAttribute('aria-live','polite');
  const creditInputs=()=>[...ledgerList.children].map(row=>({id:row.dataset.creditId,kind:row._creditFields.kind.value,milestoneId:row._creditFields.target.value,amount:row._creditFields.amount.value,reference:row._creditFields.ref.value}));
  function updateTotals(){
   try{const l=prepareFinancialReview(p,note.value||'Preview only',creditInputs());totals.textContent=`Contract ${formatExactUsd(l.grossMinor)} USD − credits ${formatExactUsd(l.creditedMinor)} USD = outstanding ${formatExactUsd(l.outstandingMinor)} USD`;
    if(l.creditedMinor>0)totals.textContent+=' · Net draft requires later explicit exact-amount confirmation';}
   catch(e){totals.textContent=`Preview incomplete: ${e.message}`;}
  }
  note.addEventListener('input',updateTotals);form.append(add,ledgerList,totals);
  const check=el('input');check.type='checkbox';check.required=true;const consent=el('label','','check');consent.append(check,el('span','I reviewed every milestone, recorded ALL known payments and credits (including zero credits), and checked supporting accounting evidence. This is a local record only, not proof of client acceptance or authority to invoice.'));
  const submit=el('button','Save financial review · reset acceptance');submit.type='submit';form.append(consent,submit);
  form.onsubmit=e=>{e.preventDefault();run(()=>mutate(async()=>{
   if(!form.reportValidity()||!check.checked)return;
   const prepared=prepareFinancialReview(p,note.value,creditInputs());
   await api(`/api/projects/${p.id}/receivable`,{confirmed:true,expectedRevision:p.receivableLedger?.id||null,agreementVersionId:p.agreementVersionId,complete:true,confirmation:prepared.confirmation,gross:prepared.gross,credits:prepared.credits});
   await reload(p.id);
   message(prepared.creditedMinor>0?'Credit ledger recorded. After fresh acceptance, explicitly authorize the exact net amount; no invoice was created.':'Financial review saved. Record fresh client acceptance separately; no invoice created.','success');
  }));};reconcile.append(form);inspector.append(reconcile);updateTotals();
 }
 const actionGroup=el('div','','payment-actions');
 const gotoAgreement=()=>{state.index=selected.index;state.selectedMilestoneId=selected.canonicalId;syncRoute();navigate('agreement');};
 if(['blocked','amendment','pending','uncertain','reconcile'].includes(vm.code)||(vm.code==='unknown'&&!vm.invoice))actionGroup.append(button('Review agreement & evidence →',gotoAgreement));
 if(vm.code==='uncertain')actionGroup.append(el('p','Draft creation may have reached PayPal. Reconcile the Sandbox before any retry; no new draft can be created from this state.','payment-alert'));
 if(vm.invoice){
  const inv=vm.invoice;
  actionGroup.append(button('Refresh PayPal status',async()=>{
   state.inspectorNotice='Checking PayPal Sandbox…';actionNotice.textContent=state.inspectorNotice;
   try{await mutate(async()=>{await api(`/api/projects/${p.id}/invoices/${encodeURIComponent(inv.invoiceId)}/refresh`,{});await reload(p.id);state.inspectorNotice='PayPal status was refreshed. Check the latest stored read-back time.';message('PayPal read-back stored.','success');});}
   catch(err){state.inspectorNotice=`Refresh failed: ${err.message}. Last stored status remains unchanged and may be stale.`;actionNotice.textContent=state.inspectorNotice;renderPayments();throw err;}
  }));
  const details=el('details','','payment-invoice-details');details.append(el('summary',`Invoice details · ${inv.invoiceId||'ID not available'}`),el('p',`Last known status: ${inv.status||'UNKNOWN'}`),el('p',`Last checked: ${inv.lastVerifiedAt?new Date(inv.lastVerifiedAt).toLocaleString():'Not verified'}`),el('p',`Invoice total: ${inv.total?money(inv.total.value,inv.total.currency):'Not returned'}`),el('p',`Amount due: ${inv.dueAmount?money(inv.dueAmount.value,inv.dueAmount.currency):'Not returned'}`));
  if(inv.authorization){const a=inv.authorization;details.append(el('p',`Saved authorization: ${Number(a.amountMinor/100).toFixed(2)} ${a.currency} · source gross ${Number((a.grossMinor??a.amountMinor)/100).toFixed(2)} · recorded credits ${Number((a.creditedMinor??0)/100).toFixed(2)} · ledger revision ${a.ledgerRevisionId||'missing'} · ${a.netAmountAuthorized?'net authorization':'gross authorization'}`,'small'));}
  const history=el('details');history.append(el('summary','Stored status history'));for(const e of inv.statusHistory||[])history.append(el('p',`${e.status||'Unknown'} · ${e.observedAt?new Date(e.observedAt).toLocaleString():'Time unavailable'} · ${e.source||'Source unavailable'}`));if(!inv.statusHistory?.length)history.append(el('p','No stored transitions for this invoice.'));details.append(history);actionGroup.append(details);
 }
 if(vm.canCreateDraft&&!p.archivedAt){
  const draftPreview=renderInvoicePreview(p,selected);if(draftPreview)actionGroup.append(draftPreview);
  const row=p.receivable?.status==='HUMAN_RECORDED'?p.receivable.milestones?.find(r=>r.milestoneId===selected.canonicalId):null;
  const exactNet=Boolean(row&&row.creditedMinor>0);
  const invoiceAmount=row?formatExactUsd(row.outstandingMinor):String(selected.amount);
  const form=el('form','','payment-draft-form');const label=el('label','Sandbox recipient email');const email=el('input');email.type='email';email.required=true;email.autocomplete='off';email.id=`recipient-${selected.index}`;label.htmlFor=email.id;
  // The read-only preview directly above shows gross, credits and amount only once.
  if(exactNet)form.append(el('p','These credits are local human attestations. Confirm they were correctly allocated and are not duplicated. FairPay does not verify bank deposits, client identity, or legal invoice entitlement.','payment-alert'));
  let exactInput=null;
  {
   const exactLabel=el('label',`Type exact invoice amount in USD (${invoiceAmount})`);
   exactInput=el('input');exactInput.type='text';exactInput.required=true;exactInput.inputMode='decimal';exactInput.autocomplete='off';exactInput.placeholder=invoiceAmount;
   exactLabel.append(exactInput);form.append(exactLabel);
  }
  const consentLabel=el('label','','check');const consent=el('input');consent.type='checkbox';consent.required=true;
  consentLabel.append(consent,el('span',`I independently reviewed the ledger, current evidence, client acceptance, recipient and ${money(row?.outstandingMinor/100??selected.amount,p.currency)} amount. I authorize ONE unsent Sandbox draft.`));
  const submit=el('button','Create Sandbox draft');submit.type='submit';form.append(label,email,consentLabel,submit);
  form.onsubmit=e=>{e.preventDefault();run(async()=>{
   if(!consent.checked||!form.reportValidity())return;
   if(exactInput.value!==invoiceAmount){message(`Enter exactly ${invoiceAmount} USD including cents before authorizing a draft.`,'error');return;}
   if(!confirm(`Create ONE unsent Sandbox draft for ${selected.title}, ${money(row?.outstandingMinor/100??selected.amount,p.currency)}, to ${email.value}? This uses financial ledger revision ${p.receivableLedger?.id||'missing'}.`))return;
   const recipientEmail=email.value;consent.checked=false;state.inspectorNotice='Submitting one draft request. Do not repeat if the outcome is uncertain.';actionNotice.textContent=state.inspectorNotice;
   try{await mutate(async()=>{await api(`/api/projects/${p.id}/drafts`,{milestoneIndex:selected.index,recipientEmail,confirmed:true,agreementVersionId:p.agreementVersionId,
     authorizedAmount:exactInput.value,ledgerRevisionId:p.receivableLedger.id,netAmountConfirmed:true});await reload(p.id);const saved=project()?.milestones?.find(x=>x.canonicalId===selected.canonicalId)?.invoices?.at(-1);state.inspectorNotice=saved?.status==='DRAFT'?'PayPal Sandbox DRAFT saved · NOT SENT. Review the stored invoice below and verify its current status.':'Request completed; the resulting PayPal status must be verified before any further action.';message(state.inspectorNotice,'success');});}
   catch(err){state.inspectorNotice=`Draft request unresolved or failed: ${err.message}. Do not blindly retry. Reconcile the Sandbox invoice first.`;actionNotice.textContent=state.inspectorNotice;renderPayments();throw err;}
  });};actionGroup.append(form);
 }
 inspector.append(actionGroup);const historyDisclosure=el('details','','payment-history-disclosure');historyDisclosure.append(el('summary','Activity & audit history'),renderActivity(p,true));inspector.append(historyDisclosure);
 // Project management actions live in Overview > Project Details (not Payments).
 grid.append(queue,inspector);area.append(grid);area.classList.toggle('mobile-detail-visible',state.paymentMobileDetail);
}



function readableTime(iso){if(!iso)return 'Time unavailable';const d=new Date(iso);return Number.isNaN(d.getTime())?'Time unavailable':d.toLocaleString();}
function renderActivity(p,compact=false){
 const section=el('section','','activity-section');const heading=el('div','','activity-heading');heading.append(el('strong',compact?'Recent activity':'Project activity & decision history'),el('small',compact?'Last 4 recorded events':'Local operational history · editable, not compliance-grade'));section.append(heading);
 const recent=el('div','','activity-list');const items=timelineEvents(p);const buildRow=x=>{
  const n=el('div','','activity-item');n.append(el('strong',x.label),el('small',`${readableTime(x.when)} · ${x.actor} · ${x.outcome}`));
  if(x.status)n.append(el('span',`Recorded status: ${x.status}`,'small'));
  if(x.changed===false)n.append(el('span','Read-back successful · status unchanged','small'));
  if(x.changed===true)n.append(el('span','PayPal status changed in this read-back','small'));
  if(x.invoiceId)n.append(el('span',`Invoice: ${x.invoiceId}`,'small'));
  if(x.version)n.append(el('span',`Agreement version: ${x.version.slice(0,8)}…`,'small'));
  if(x.hasComparison){const d=el('details');d.append(el('summary','View before / after'));for(const after of x.event.after||[]){const before=x.event.before?.find(m=>m.canonicalId===after.canonicalId);d.append(el('p',`${after.title}: ${before?money(before.amount,p.currency):'No matching previous milestone'} → ${money(after.amount,p.currency)}`));}n.append(d);}
  return n;
 };
 recent.replaceChildren(...items.slice(0,compact?4:5).map(buildRow));if(!items.length)recent.append(el('p','No activity recorded for this legacy project.','muted'));section.append(recent);
 const all=el('details','','activity-all');all.append(el('summary',`All activity · ${items.length} events`));
 const controls=el('div','','activity-controls');const label=el('label','Filter history');const filter=el('select');label.append(filter);
 for(const [value,name] of [['all','All events'],['agreement','Agreement & evidence'],['approval','Approvals'],['paypal','PayPal'],['project','Project settings']]){const op=el('option',name);op.value=value;filter.append(op);}controls.append(label);
 const download=button('Download activity (.md)',()=>downloadMarkdown(safeAuditMarkdown(p),`FairPay-activity-${p.name}`),'secondary');controls.append(download);all.append(controls);
 const full=el('div','','activity-list');const draw=()=>{const filtered=timelineEvents(p,filter.value);full.replaceChildren(...filtered.map(buildRow));if(!filtered.length)full.append(el('p','No matching recorded events.','muted'));};filter.onchange=draw;draw();all.append(full);
 all.append(el('p','Local editable history; not signed or tamper-proof. Client identity and payment cannot be inferred from a user record.','small muted'));section.append(all);return section;
}

function renderResolve(){
 const area=$('resolve');area.replaceChildren();const p=project();if(!p)return;
 area.append(el('p','FAIRPAY RESOLVE','eyebrow'),el('h2','Clarify the source. Reassess the decision.'));
 const versions=p.agreementVersions||[];
 if(versions.length>=2){
  const selectedBeforeId=state.compareBefore?.[p.id]||versions.at(-2).id;
  const before=versions.find(v=>v.id===selectedBeforeId&&v.id!==p.agreementVersionId)||versions.at(-2);
  const after=versions.find(v=>v.id===p.agreementVersionId)||versions.at(-1);
  const result=compareAgreementVersions(before,after);
  const comparison=el('section','','resolve-comparison');comparison.tabIndex=-1;comparison.append(el('h3','What changed after re-analysis?'));
  comparison.append(el('p','Comparison of saved source versions and recorded policy findings. This does not prove client acceptance or authorize any invoice.','muted'));
  const selector=el('label','Compare earlier version');const picker=el('select');picker.setAttribute('aria-label','Earlier agreement version');
  for(const v of versions.filter(v=>v.id!==after.id)){const option=el('option',`Source · ${new Date(v.at).toLocaleString()}`);option.value=v.id;picker.append(option);}picker.value=before.id;
  picker.onchange=()=>{state.compareBefore??={};state.compareBefore[p.id]=picker.value;renderResolve();};selector.append(picker);comparison.append(selector);
  if(result?.incomplete)comparison.append(el('p','Comparison unavailable: this older version lacks recorded decision snapshots. Review its full source manually.','callout'));
  else for(const row of result?.rows||[]){
   const item=el('div','','resolve-diff-item');item.append(el('strong',`${row.title} · ${row.change==='added'?'New milestone':row.change==='removed'?'Removed milestone':'Earlier vs current'}`));
   const columns=el('div','','resolve-diff-columns');
   for(const [label,decision,status,quote] of [['Before',row.before,row.beforeStatus,row.beforeQuote],['After',row.after,row.afterStatus,row.afterQuote]]){
    const cell=el('div','','resolve-diff-cell');cell.append(el('small',label),el('strong',status.label),el('p',decision?.amount!=null?`Recorded amount: USD ${decision.amount}`:'Recorded amount: unresolved'),el('p',decision?.riskCodes?.length?`Policy flags: ${decision.riskCodes.join(', ')}`:'Policy flags: none recorded'));
    cell.append(el('p',`Recorded client acceptance: ${decision?.approvalStatus==='approved'?'user-recorded (not independently authenticated)':'not recorded'}`,'muted'));
    if(quote)cell.append(el('blockquote',quote));else cell.append(el('p','No source-verified quote available for this snapshot.','muted'));
    columns.append(cell);
   }item.append(columns);comparison.append(item);
  }
  comparison.append(el('p','Re-analysis resets earlier acceptance and amendment acknowledgments. Terms evidenced ≠ approved to invoice.','small muted'));
  area.append(comparison);
 }else area.append(el('p',versions.length===1?'This project has one saved source version. Supply clarified written terms to compare a later decision.':'No full agreement-version history is available; previous decisions cannot be reconstructed.','small muted'));
 const m=p.milestones[state.index]||p.milestones[0];
 if(m)area.append(button('Draft clarification',async()=>{const {draft}=await api(`/api/projects/${p.id}/clarification`,{milestoneIndex:m.index});const label=el('label','Editable clarification — not sent');const text=el('textarea');text.value=draft;text.rows=8;text.id='clarificationDraft';label.htmlFor=text.id;const copy=button('Copy clarification',async()=>{try{await navigator.clipboard.writeText(text.value);message('Copied. Nothing was sent and no approval changed.');}catch{text.focus();text.select();message('Clipboard unavailable. Copy the selected text manually.');}});area.append(label,text,copy);text.focus();}));
 for(const v of p.agreementVersions||[]){const detail=el('details');detail.append(el('summary',`Source ${v.id===p.agreementVersionId?'(current) ':''}${new Date(v.at).toLocaleString()}`),el('small',`Version ${v.id} · SHA-256 ${v.sourceHash}`),el('blockquote',v.sourceText));area.append(detail);}
 if(!p.agreementVersions?.length)area.append(el('p','Full original source unavailable. Paste the complete updated agreement, including controlling amendments and credits.','callout'));
 if(!p.archivedAt){
  if(p.name==='Synthetic Coral Packaging Design'&&versions.length===1&&versions[0].sourceText?.includes('proposed unsigned amendment')){
   const demo=button('Load synthetic clarified terms (example only)',()=>{
    state.resolveText[p.id]=EXAMPLE_RESOLVED_AGREEMENT;
    renderResolve();const editor=$('updatedAgreement');editor?.focus();editor?.scrollIntoView({block:'center'});
    message('Synthetic revised wording loaded into the editor only. Review it, consent to local storage, and run re-analysis; no acceptance or invoice was recorded.','info');
   });demo.className='secondary resolve-demo';area.append(demo);
   area.append(el('p','Demo scenario only: no actual signature, client approval or billing authorization is represented.','small muted'));
  }
  const form=el('form');const label=el('label','Full updated agreement');label.htmlFor='updatedAgreement';const text=el('textarea');text.id='updatedAgreement';text.rows=8;text.minLength=50;text.maxLength=12000;text.required=true;text.value=state.resolveText[p.id]??p.agreementVersions?.at(-1)?.sourceText??'';text.oninput=()=>state.resolveText[p.id]=text.value;
 const check=el('input');check.type='checkbox';check.required=true;const consent=el('label','','check');consent.append(check,el('span','I consent to storing this source version locally, unencrypted. Re-analysis invalidates prior approval; pasted text is not verified acceptance.'));
 const submit=el('button','Save evidence & re-analyze');submit.type='submit';form.append(label,text,consent,submit);form.onsubmit=e=>{e.preventDefault();run(()=>mutate(async()=>{if(!form.reportValidity())return;state.resolveText[p.id]=text.value;message('Re-analyzing updated source evidence. Current approvals are invalidated during re-analysis.','info');await api(`/api/projects/${p.id}/reanalyze`,{contractText:text.value,persistEvidence:check.checked,agreementVersionId:p.agreementVersionId});await reload(p.id);message('New evidence analyzed and saved. Review changes and record fresh client acceptance.');}));};area.append(form);if(p.milestones.some(m=>m.invoices.length||m.creationState))area.append(el('p','Existing or uncertain invoices must be reconciled before agreement changes. Their IDs and history are preserved.','callout'));}
 area.append(renderActivity(p,false));

}

// v1.8.1 · Display-only appearance preference. Never affects policy, approvals, or PayPal.
const THEME_KEY='fairpay-ui-theme-v1';
function applyTheme(theme){const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('themeToggle').setAttribute('aria-pressed',String(dark));$('themeToggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');$('themeLabel').textContent=dark?'Light mode':'Dark mode';$('themeSymbol').textContent=dark?'☀':'◐';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#101d1b':'#112b26');try{localStorage.setItem(THEME_KEY,dark?'dark':'light');}catch{}}
function savedTheme(){try{return localStorage.getItem(THEME_KEY)==='dark'?'dark':'light';}catch{return 'light';}}
$('themeToggle').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
applyTheme(savedTheme());

// Import is explicitly local, size-bounded, and never mutates projects by itself.
const MAX_IMPORT_BYTES=2*1024*1024;
const SUPPORTED_IMPORTS=new Set(['txt','md','docx','pdf']);
function sourceFromFile(text,name,sizeBytes){
 const clean=text.replace(/\u0000/g,'').trim();
 if(clean.length<50||clean.length>12000)throw Error(`Extracted text must be between 50 and 12,000 characters (found ${clean.length}). Please use an excerpt if your document is longer.`);
 $('agreement').value=clean;
 $('agreement').dispatchEvent(new Event('input',{bubbles:true}));
 $('documentStatus').textContent=`Import complete: ${name}. Review the editable text; the agreement has not been analyzed or saved.`;
 $('importReceipt').hidden=false;
 $('importReceiptTitle').textContent=`Imported: ${name}`;
 $('importReceiptDetails').textContent=`${(sizeBytes/1024).toFixed(1)} KB · ${clean.length.toLocaleString()} characters extracted locally · Ready for review (not analyzed or saved).`;
 setSourceMethod('paste');
 message('Document text imported locally. Review the text before analysis; no project or invoice was created.','success');
 $('agreement').focus();
}
async function base64File(file){const raw=await file.arrayBuffer();const bytes=new Uint8Array(raw);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
async function importDocument(file){
 if(!file)return;
 if(state.importBusy)throw Error('An import is already running. Wait until it finishes.');
 const ext=file.name.split('.').at(-1)?.toLowerCase();
 if(!SUPPORTED_IMPORTS.has(ext))throw Error('Unsupported file type. Use .txt, .md, .docx, or a text-based .pdf.');
 if(!file.size||file.size>MAX_IMPORT_BYTES)throw Error('File must be nonempty and no larger than 2 MB.');
 if($('agreement').value.trim()&&!confirm('Replace the existing agreement text with this file? Unsaved edits in the text box will be replaced.'))return;
 state.importBusy=true;
 $('documentDropZone').dataset.state='loading';$('documentDropZone').setAttribute('aria-busy','true');
 $('documentStatus').textContent=`Reading ${file.name}… The current project has not been modified.`;
 $('chooseDocument').disabled=true;
 try{
  let content;
  if(ext==='txt'||ext==='md')content=await file.text();
  else {const out=await api('/api/documents/extract',{filename:file.name,contentBase64:await base64File(file)});content=out.text;}
  sourceFromFile(content,file.name,file.size);
  $('documentDropZone').dataset.state='success';
 }catch(e){
  $('documentDropZone').dataset.state='error';
  $('documentStatus').textContent=`Could not import ${file.name}. Existing agreement text is unchanged; no project or invoice was created.`;
  throw e;
 }finally{
  state.importBusy=false;$('documentDropZone').removeAttribute('aria-busy');$('chooseDocument').disabled=false;
 }
}
const drop=$('documentDropZone'),fileInput=$('documentFile');
async function runImport(file){try{await importDocument(file);}catch(error){$('documentDropZone').dataset.state='error';$('documentStatus').textContent=`Import failed: ${error.message} Existing agreement text and saved projects were not changed.`;throw error;}}
$('chooseDocument').onclick=()=>fileInput.click();
$('editImportedText').onclick=()=>{setSourceMethod('paste');$('agreement').focus();$('agreement').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});};
fileInput.onchange=()=>{const file=fileInput.files?.[0];run(async()=>{try{await runImport(file);}finally{fileInput.value='';}});};
for(const event of ['dragenter','dragover'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('is-dragover');});
for(const event of ['dragleave','dragend'])drop.addEventListener(event,e=>{e.preventDefault();if(!drop.contains(e.relatedTarget))drop.classList.remove('is-dragover');});
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-dragover');const file=e.dataTransfer?.files?.[0];run(()=>runImport(file));});

function markdownText(s){return String(s??'').replace(/\r/g,'').replace(/\u0000/g,'');}
function safeFileName(s){return String(s||'fairpay').replace(/[^a-z0-9-_]+/gi,'-').replace(/-+/g,'-').slice(0,55)||'fairpay';}
function downloadMarkdown(text,filename){const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=safeFileName(filename)+'.md';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);const notice=$('exportStatus');if(notice)notice.textContent=`Export started: ${link.download}. Confirm the file appears in your Downloads folder; FairPay cannot verify that it was saved.`;message(`Export requested: ${link.download}. Check the browser Downloads folder.`, 'info');}
function reportLine(m,currency,i){return [`## Milestone ${i+1}: ${markdownText(m.title)}`,`- Source-backed amount: ${money(m.amount,currency)}`,`- Verification: ${markdownText(m.amount_verification||m.readiness?.code||'Not available')}`,`- Next action: ${markdownText(m.readiness?.next||'Review original contract and actual acceptance')}`,`- Financial risks: ${markdownText((m.financialRiskReasons||[]).join('; ')||'None listed')}`,`- Evidence excerpt:`, '> '+markdownText(m.source_excerpt||'Not available').replace(/\n/g,'\n> '),''].join('\n');}
function analysisReport(){if(!state.analysis?.milestones?.length)throw Error('Analyze a document before downloading a report.');const a=state.analysis;const name=$('projectName').value.trim()||'Agreement review';return [`# FairPay AI · Analysis report`, '',`Project: ${markdownText(name)}`,`Currency: ${markdownText(a.currency_code||'Unknown')}`,`Exported: ${new Date().toISOString()}`,`Status: Local AI-assisted assessment; NOT an approved invoice or legal review.`,'','Financial policy and human approval still apply. No PayPal request is created by this download.','',...a.milestones.map((m,i)=>reportLine(m,a.currency_code,i)),`Warnings: ${markdownText((a.warnings||[]).join('; ')||'None listed')}`].join('\n');}
function projectReport(p){return [`# FairPay AI · Project summary`,'',`Project: ${markdownText(p.name)}`,`Exported: ${new Date().toISOString()}`,`Currency: ${markdownText(p.currency)}`,`Payment status: Stored values only; verify directly against PayPal.`,`This export is NOT evidence of payment, acceptance, or legal validity.`,'',...p.milestones.map((m,i)=>[reportLine(m,p.currency,i),`- Client acceptance: ${markdownText(m.approvalStatus||'Not recorded')}`,`- PayPal invoice read-backs: ${m.invoices?.length||0}`,...(m.invoices||[]).map(inv=>`  - ${markdownText(inv.invoiceId||'ID unknown')}: ${markdownText(inv.status||'Unverified')} (last verified: ${markdownText(inv.lastVerifiedAt||'not available')})`),''].join('\n'))].join('\n');}
$('downloadAnalysis').onclick=()=>run(()=>downloadMarkdown(analysisReport(),`FairPay-analysis-${$('projectName').value||'agreement'}`));
$('printAnalysis').onclick=()=>{if(!state.analysis)return;$('exportStatus').textContent='Opening the print dialog. Choose Save as PDF yourself; FairPay cannot confirm the file was saved.';window.print();};
let printWasOpen=false;window.addEventListener('beforeprint',()=>{printWasOpen=$('analysisDetails').open;const printable=!$('analysisResult').hidden&&state.page==='agreement';document.body.classList.toggle('print-analysis',printable);if(printable)$('analysisDetails').open=true;});
window.addEventListener('afterprint',()=>{$('analysisDetails').open=printWasOpen;document.body.classList.remove('print-analysis');});

$('newAgreement').onclick=newAgreement;$('anotherAgreement').onclick=newAgreement;
$('welcomeCreate').onclick=newAgreement;$('welcomeExample').onclick=startExample;$('welcomeClear').onclick=startClearExample;$('welcomeConflict').onclick=startExample;$('paymentsStart').onclick=newAgreement;
$('editSource').onclick=()=>{$('ingestion').classList.add('show-source');setSourceMethod('paste');$('agreement').focus();};
$('reload').onclick=()=>run(()=>reload());$('projectsRetry').onclick=()=>run(()=>reload());$('search').oninput=renderProjects;$('showArchived').onchange=renderProjects;
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));renderProjects();};$('reviewIssues').onclick=()=>document.querySelector('[data-filter=review]').click();
for(const id of ['reviewProject','paymentProject'])$(id).onchange=e=>choose(e.target.value);
$('sample').onclick=()=>loadExample(EXAMPLE_AGREEMENT,'Conflicting-fee');$('sampleClear').onclick=()=>loadExample(CLEAR_EXAMPLE_AGREEMENT,'Clear-fee');
function setAnalysisProgress(active){
 const panel=$('analysisProgress');panel.hidden=!active;
 if(state.progressTimer){clearInterval(state.progressTimer);state.progressTimer=null;}
 if(!active){return;}
 const start=Date.now();const update=()=>{
  const sec=Math.floor((Date.now()-start)/1000);
  $('analysisElapsed').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')} elapsed`;
  $('analysisProgressMessage').textContent=sec>=30?'Still analyzing locally. Larger agreements can take longer…': 'Reviewing payment terms with local AI…';
 };
 update();state.progressTimer=setInterval(update,1000);
}
function renderAnalysis(data,contractText){
 $('agreementPage').classList.add('result-mode');
 const overview=$('analysisOverview');overview.replaceChildren();
 const s=billingSummary(data);
 const top=el('div','','analysis-overview-head');top.append(el('span',s.status,`status ${s.blocked?'blocked':s.amended?'amendment':'ready'}`),el('small',`${data.milestones.length} milestone${data.milestones.length===1?'':'s'} · ${data.currency_code||'Currency unverified'}`));overview.append(top);
 overview.append(el('h3',s.headline),el('p',s.primary,'decision-primary'));
 if(s.blocked){const mentions=amountSourceMentions(contractText,4);if(mentions.length){const evidence=el('div','','source-mentions');const head=el('div','','source-mentions-head');head.append(el('strong','Amounts in the agreement'),el('small','Source mentions only · not authorized fees'));evidence.append(head);for(const item of mentions){const row=el('div','','source-mention');row.append(el('strong',item.label),el('p',item.excerpt));evidence.append(row);}overview.append(evidence);}}
 if(data.milestones.length){
  const amounts=el('div','','overview-milestones');for(const m of data.milestones){const item=el('div','','overview-milestone');item.append(el('small',m.title),el('strong',money(m.amount,data.currency_code)));amounts.append(item);}overview.append(amounts);
 }
 const next=el('div','','decision-next');next.append(el('strong','Next step'),el('p',s.next));overview.insertBefore(next,overview.querySelector('.source-mentions, .overview-milestones'));
 const act=el('div','','overview-actions');const saveLink=el('button','Continue to save ↓','');saveLink.type='button';saveLink.onclick=()=>{$('saveProjectPanel').scrollIntoView({behavior:'smooth',block:'center'});$('projectName').focus({preventScroll:true});};act.append(saveLink);
 const evidenceBtn=el('button','Review source evidence','secondary');evidenceBtn.type='button';evidenceBtn.onclick=()=>{$('analysisDetails').open=true;$('analysisDetails').scrollIntoView({behavior:'smooth',block:'start'});};act.append(evidenceBtn);overview.append(act);
 const cards=$('analysisCards');cards.replaceChildren(...data.milestones.map((m,i)=>{const n=el('article','','milestone');n.append(el('p',`MILESTONE ${i+1}`,'eyebrow'),el('strong',m.title),el('p',money(m.amount,data.currency_code),'preview-amount'),el('blockquote',m.source_excerpt||'Source evidence unavailable'));
  if((m.financialRiskReasons||[]).length){const list=el('ul','','verified-reasons');for(const reason of m.financialRiskReasons)list.append(el('li',reason));n.append(list);}else n.append(el('p','No additional policy reason recorded for this milestone. Actual acceptance and authorization remain separate.','muted small'));return n;}));
 const decision=$('analysisDecision');decision.replaceChildren();for(const m of data.milestones){const box=el('div','','preview-decision');box.append(el('strong',m.title),el('p',`Verification: ${m.amount_verification||'Not available'}`,'small'),el('p',`Source excerpt matched: ${m.evidence_matched?'Yes':'No'}`,'small'));
  if(m.financialRiskCodes?.length)box.append(el('p',`Policy findings: ${m.financialRiskCodes.join(', ')}`,'small'));decision.append(box);}
 if(s.reasons.length){const detailed=el('details','','all-findings');detailed.append(el('summary',`${s.reasons.length} verified review finding${s.reasons.length===1?'':'s'}`));const list=el('ol');for(const reason of s.reasons)list.append(el('li',reason));detailed.append(list);decision.append(detailed);}
 $('analysisDetailCount').textContent=`· ${data.milestones.length} milestone${data.milestones.length===1?'':'s'}`;
 $('analysisDetails').open=false;
}
$('analyze').onclick=()=>run(()=>mutate(async()=>{
 const contractText=$('agreement').value;
 if(contractText.trim().length<50)throw Error('Enter at least 50 characters of agreement text.');
 state.analysis=null;$('analysisResult').hidden=true;$('ingestion').classList.remove('has-analysis');
 setAnalysisProgress(true);message('');
 try{
  const data=await api('/api/analyze',{contractText});
  if($('agreement').value!==contractText)throw Error('Agreement changed while analysis was running. Analyze the current text again.');
  state.analysis=data;$('analysisResult').hidden=false;$('ingestion').classList.add('has-analysis');$('ingestion').classList.remove('show-source');
  $('projectName').value=suggestProjectName(contractText,data.project_summary);
  renderAnalysis(data,contractText);
  message(`Agreement analysis complete · ${billingSummary(data).status}. No invoice has been created.`,'success');
  $('analysisResult').focus();$('analysisResult').scrollIntoView({block:'start'});
 }finally{setAnalysisProgress(false);}
}));
$('agreement').oninput=()=>{updateSourceCount();if(!$('importReceipt').hidden){$('importReceiptTitle').textContent='Imported text modified';$('importReceiptDetails').textContent='The editable agreement text has changed since import. Review the updated wording before analysis.';}state.analysis=null;$('analysisResult').hidden=true;$('ingestion').classList.remove('has-analysis');$('agreementPage').classList.remove('result-mode');};
$('save').onclick=()=>run(async()=>{await mutate(async()=>{if(!state.analysis?.milestones.length)throw Error('Analyze an agreement with milestones before saving.');const data=await api('/api/projects',{analysisId:state.analysis.analysisId,name:$('projectName').value,persistEvidence:$('persistEvidence').checked});state.index=0;state.selectedMilestoneId=null;await reload(data.project.id);state.justSavedProject=data.project.id;message('Review saved locally. Continue to Billing Workspace when ready; no invoice has been created.','success');});if(state.justSavedProject){navigate('payments');}});
window.addEventListener('hashchange',()=>{if(location.hash!=='#main')showPage();});showPage(false);run(()=>reload());api('/api/health').then(h=>{
 const destination=h.aiProvider==='ollama'?'Ollama on this Mac (loopback)':h.aiProvider==='openai'?'OpenAI cloud API (agreement text sent outside this Mac)':'Unknown provider (do not analyze)';
 $('serviceStatus').textContent=`Release ${h.productVersion||h.appVersion} · AI: ${destination} · ${h.aiConfigured?'configured':'unavailable'} · Sandbox credentials: ${h.paypalConfigured?'configured':'not configured'}`;
 const notice=$('aiDataDestination');if(notice){notice.textContent=h.aiProvider==='ollama'?
  (h.aiConfigured?'AI destination: local Ollama on this Mac. Analysis does not send your contract to PayPal. Saved source text is unencrypted if you opt in.':'Local Ollama is not ready. You can preview synthetic sample text now, but AI extraction requires running Ollama and the configured model (see README). Nothing is analyzed or billed by loading a sample.') :
  h.aiProvider==='openai'?'AI destination: OpenAI cloud. Analyzing WILL send agreement text to the configured external provider. Use only synthetic or authorized content. No PayPal request occurs at analysis.':
  'AI provider is not recognized. Do not submit sensitive agreements.';notice.dataset.provider=h.aiProvider;}
}).catch(()=>{$('serviceStatus').textContent='Service status unavailable; AI processing location unverified.';const notice=$('aiDataDestination');if(notice)notice.textContent='AI processing location is unavailable. Do not submit sensitive data.';});
