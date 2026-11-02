"""Limited source/archive accidental-secret gate; no forensic PII assurance."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import importlib.util,zipfile,json
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('builder',root/'tools/build-clean.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
target=Path(sys.argv[1]) if len(sys.argv)>1 else root
issues=[];count=0
if target.is_file():
 with zipfile.ZipFile(target) as z:
  if z.testzip():issues.append('ZIP CRC failure')
  for n in z.namelist():
   if n.endswith('/'):continue
   count+=1
   try:mod.scan(n,z.read(n))
   except ValueError as e:issues.append(str(e))
else:
 for p in target.rglob('*'):
  rel=p.relative_to(target)
  if '.git' in rel.parts or p.is_dir():continue
  count+=1
  try:
   # Check names before opening files; never read credential/runtime files.
   mod.scan(str(rel),b'')
   if p.is_symlink():raise ValueError('Symlink: '+str(rel))
   mod.scan(str(rel),p.read_bytes())
  except ValueError as e:issues.append(str(e))
print(json.dumps({'checked':count,'issues':issues,'scope':'Forbidden paths and obvious secret patterns; not PII certification.'},indent=2));raise SystemExit(bool(issues))
