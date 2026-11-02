#!/usr/bin/env python3
"""Run every historical test file unchanged, sequentially with process-group cleanup."""
from pathlib import Path
import argparse,subprocess,os,signal,time,json,re,datetime
APP=Path(__file__).resolve().parents[1]
def run_file(file,out,timeout):
 start=time.monotonic();log=out/(file.stem+'.tap');env={'PATH':os.environ['PATH'],'HOME':str(out),'TMPDIR':str(out/'tmp'),'NODE_ENV':'test','AI_PROVIDER':'ollama','OLLAMA_PORT':'9','PAYPAL_CLIENT_ID':'','PAYPAL_CLIENT_SECRET':'','OPENAI_API_KEY':''}
 with log.open('x') as stream:
  p=subprocess.Popen(['node','--test','--test-reporter=tap',str(file)],cwd=APP,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
  timed=False
  try:p.wait(timeout=timeout)
  except subprocess.TimeoutExpired:timed=True
  finally:
   # All children inherit this private group; cleanup also on assertion failures.
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:p.wait(timeout=2)
   except subprocess.TimeoutExpired:pass
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   p.wait()
 text=log.read_text();rows=[]
 for m in re.finditer(r'^(not ok|ok) (\d+) - (.+)$',text,re.M):rows.append({'name':m[3],'status':'FAIL' if m[1]=='not ok' else 'PASS'})
 return {'file':os.path.relpath(file,APP),'command':['node','--test','--test-reporter=tap',os.path.relpath(file,APP)],'exitCode':p.returncode,'timeout':timed,'durationSeconds':round(time.monotonic()-start,3),'log':log.name,'cases':rows,'classification':'TEST_HANG_OR_LEAK' if timed else ('UNVERIFIED' if p.returncode else 'PASS')}
def main():
 a=argparse.ArgumentParser();a.add_argument('--output',required=True);a.add_argument('--timeout',type=float,default=30);args=a.parse_args()
 out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=False);(out/'tmp').mkdir();results=[]
 files=sorted((APP/'tests').glob('*.test.mjs'))
 (out/'PLAN.json').write_text(json.dumps({'files':[str(f.relative_to(APP)) for f in files],'timeoutPerFile':args.timeout,'sourceCommit':(subprocess.check_output(['git','rev-parse','HEAD'],cwd=APP).decode().strip() if (APP/'.git').exists() else json.loads((APP/'CANDIDATE_MANIFEST.json').read_text())['sourceCommit']),'method':'Unchanged tests, sequential isolated process groups, clean credential environment. No tests excluded.'},indent=2))
 for file in files:
  result=run_file(file,out,args.timeout);results.append(result)
  # Checkpoint after every file so interrupted runs retain all completed outcomes.
  with (out/'RESULTS.jsonl').open('a') as f:f.write(json.dumps(result)+'\n')
  print(result['file'],result['classification'],result['exitCode'],result['durationSeconds'],flush=True)
 summary={'files':len(files),'completedFiles':len(results),'passFiles':sum(r['exitCode']==0 and not r['timeout'] for r in results),'timeoutFiles':sum(r['timeout'] for r in results),'casesObserved':sum(len(r['cases']) for r in results),'passedCasesObserved':sum(c['status']=='PASS' for r in results for c in r['cases']),'failedCasesObserved':sum(c['status']=='FAIL' for r in results for c in r['cases']),'note':'Timeout can prevent remaining cases from running; counts do not exclude timeouts or assert a complete case denominator.'}
 (out/'SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary));return int(summary['passFiles']!=len(files))
if __name__=='__main__':raise SystemExit(main())
