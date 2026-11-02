// Pure Overview selection and filter rules; no server-side billing authorization here.
export const REVIEW_CODES = new Set(['blocked','amendment','unknown','uncertain','reconcile']);
export function projectNeedsReview(project){return (project?.milestones||[]).some(m=>REVIEW_CODES.has(m?.readiness?.code));}
export function visibleOverviewProjects(projects,{search='',filter='all',showArchived=false}={}){
 const query=String(search).trim().toLocaleLowerCase();
 return (projects||[]).filter(p=>(showArchived||!p.archivedAt)&&String(p.name||'').toLocaleLowerCase().includes(query)&&(
  filter==='all'||(filter==='review'&&projectNeedsReview(p))||(p.milestones||[]).some(m=>m?.readiness?.code===filter)
 ));
}
export function overviewInspectorId(visible,selected){
 if(!visible?.length)return null;
 return visible.some(p=>p.id===selected)?selected:visible[0].id;
}
