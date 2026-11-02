import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {attachEvidence,audit} from './agreement-evidence.mjs';
import { createProject, publicProject, nowIso, projectFingerprint } from './project-model.mjs';

// Local-only data. Full source is saved only with explicit evidence-storage consent; never credentials.
export class ProjectStore {
  constructor(root){this.folder=path.join(root,'.local-data');this.file=path.join(this.folder,'projects.json');this.projects=new Map();this.lock=Promise.resolve();}
  async initialize(){
    await fs.mkdir(this.folder,{recursive:true,mode:0o700});
    try{const data=JSON.parse(await fs.readFile(this.file,'utf8'));
      if(!Array.isArray(data.projects))throw new Error('Project data file is invalid.');
      this.projects=new Map(data.projects.map(p=>[p.id,p]));
      if([...this.projects.values()].some(p=>p.pendingAnalysis))await this.transact(()=>{for(const p of this.projects.values())if(p.pendingAnalysis){p.pendingAnalysis=null;for(const m of p.milestones){m.reanalysisRequired=true;m.approvalStatus='pending';}audit(p,'interrupted_reanalysis_recovered');}});
    }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  get(id){return this.projects.get(id);}
  list(){return [...this.projects.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(publicProject);}
  async transact(fn){
    const action=this.lock.then(async()=>{
      const before=structuredClone(this.projects);
      try {
      const result=await fn();
      const tmp=path.join(this.folder,`.projects-${crypto.randomUUID()}.tmp`);
      try{await fs.writeFile(tmp,JSON.stringify({version:1,projects:[...this.projects.values()]},null,2),{mode:0o600});await fs.rename(tmp,this.file);}
      finally{await fs.rm(tmp,{force:true}).catch(()=>{});}
      return result;
      } catch(e) {this.projects=before;throw e;}
    });
    this.lock=action.catch(()=>{});
    return action;
  }
  async add(analysis,name){return this.transact(()=>{
    if(this.projects.size>=50)throw new Error('Project limit reached (50).');
    const p=createProject(analysis,name);
    const fingerprint=projectFingerprint(p);
    const duplicate=[...this.projects.values()].find(old=>!old.archivedAt && projectFingerprint(old)===fingerprint);
    if(duplicate){const e=new Error('This agreement already has an active project. Open the existing project or archive it before saving a new copy.');e.code='DUPLICATE_PROJECT';e.existingProjectId=duplicate.id;throw e;}
    if(analysis.persistEvidence===true)attachEvidence(p,analysis.sourceText);
    audit(p,'project_saved');
    this.projects.set(p.id,p);return publicProject(p);
  });}
  async update(id,mutator){return this.transact(()=>{
    const p=this.get(id);if(!p)throw new Error('Project not found.');
    const result=mutator(p);p.updatedAt=nowIso();return result===undefined?publicProject(p):result;
  });}
}
