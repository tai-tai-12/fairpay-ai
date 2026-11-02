#!/usr/bin/env python3
"""Tracked-source packaging; exclusive output, no history/runtime secrets, SHA/CRC verified."""
from pathlib import Path
import sys,subprocess,json,hashlib,zipfile,re
APP=Path(__file__).resolve().parents[1]
DENY={'.git','.local-data','node_modules','__pycache__','projects.json','credentials.json'}
def scan(name,data):
 p=Path(name)
 if DENY.intersection(p.parts) or (p.name.startswith('.env') and p.name!='.env.example') or p.suffix in {'.pem','.p12','.pfx','.zip'}:raise ValueError('Forbidden path: '+name)
 if re.search(rb'(?:sk-proj-[A-Za-z0-9_-]{15,}|sk-[A-Za-z0-9]{35,})',data):raise ValueError('Potential secret: '+name)
 for m in re.finditer(rb'(?m)^[ \t]*(?:PAYPAL_CLIENT_SECRET|PAYPAL_CLIENT_ID|OPENAI_API_KEY|DEMO_PASSWORD)[ \t]*=[ \t]*([^\r\n#]*)',data):
  v=m[1].strip().strip(b'\'"')
  if v and not v.lower().startswith((b'example',b'your',b'placeholder',b'${',b'<')):raise ValueError('Populated assignment: '+name)
def main():
 out=Path(sys.argv[1]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
 tracked=subprocess.check_output(['git','ls-files','-z'],cwd=APP).decode().split('\0')
 docs={'README_START_HERE.md','ARCHITECTURE.md','SECURITY_AND_PRIVACY.md','QA_STATUS.md','DEMO_GUIDE.md','KNOWN_LIMITATIONS.md','CHANGELOG_DEV8_6.md','SPRINT_B_RELEASE_NOTES.md'}
 tools={'setup.mjs','check-setup.mjs','qa-baseline-v190.mjs','build-clean.py','legacy-isolated.py','verify-clean.py','scan-clean.py','verify-package-v190.mjs','sprint-a-evaluate.mjs'}
 files={};excluded=[]
 for name in filter(None,tracked):
  p=Path(name)
  keep=(len(p.parts)==1 and (p.suffix=='.mjs' or name in docs|{'package.json','VERSION.txt','.env.example','LICENSE','SOURCE_SHA256_MANIFEST.json'})) or p.parts[0] in {'public','evaluation','tests'} or (p.parts[0]=='audit' and p.suffix in {'.mjs','.json','.txt'}) or name.startswith('docs/sprint-a/') or name.startswith('docs/sprint-b/') or name.startswith('handoff/reference_baselines/') or (p.parts[0]=='tools' and p.name in tools)
  if not keep:excluded.append(name);continue
  f=APP/name
  if f.is_symlink():raise ValueError('Symlink: '+name)
  data=f.read_bytes();scan(name,data);files[name]=data
 required=docs|{'server.mjs','public/app.js','public/style.css','.env.example','VERSION.txt','package.json'}
 if required-set(files):raise ValueError('Missing required '+str(required-set(files)))
 manifest={n:hashlib.sha256(b).hexdigest() for n,b in files.items()}
 meta={'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=APP).decode().strip(),'status':'NON-RELEASE / SANDBOX ONLY','files':manifest,'excluded':excluded,'runtime':'Node >=22 must be installed separately; no Node binary/model bundled.'}
 files['CANDIDATE_MANIFEST.json']=(json.dumps(meta,indent=2)+'\n').encode()
 with zipfile.ZipFile(out,'x',zipfile.ZIP_DEFLATED) as z:
  for n,b in files.items():z.writestr('FairPay/'+n,b)
 with zipfile.ZipFile(out) as z:
  assert z.testzip() is None
  for n,b in files.items():assert z.read('FairPay/'+n)==b
 sha=hashlib.sha256(out.read_bytes()).hexdigest()
 with Path(str(out)+'.sha256').open('x') as f:f.write(sha+'  '+out.name+'\n')
 print(json.dumps({'zip':str(out),'sha256':sha,'files':len(files),'bytes':out.stat().st_size,'sourceCommit':meta['sourceCommit']}))
if __name__=='__main__':main()
