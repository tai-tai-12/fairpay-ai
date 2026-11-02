from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'CANDIDATE_MANIFEST.json').read_text());bad=[]
for n,h in m['files'].items():
 p=root/n
 if not p.is_file() or p.is_symlink() or hashlib.sha256(p.read_bytes()).hexdigest()!=h:bad.append(n)
print(json.dumps({'checked':len(m['files']),'mismatches':bad}))
raise SystemExit(bool(bad))
