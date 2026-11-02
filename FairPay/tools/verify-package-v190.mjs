/** Verify current workspace's immutable file inventory against its release manifest.
 * Edits made AFTER this initial baseline may intentionally fail this comparison;
 * for active development, create a new checkpoint/manifest.
 * Excludes .env, .local-data and the manifest itself.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'SOURCE_SHA256_MANIFEST.json'),'utf8'));
let failed=0;
for(const [p,hash] of Object.entries(manifest.files)){
  try {
    const buf=await fs.readFile(path.join(root,p));
    const actual=crypto.createHash('sha256').update(buf).digest('hex');
    if(actual!==hash){console.error('CHANGED',p);failed++}
  }catch(e){console.error('MISSING',p);failed++}
}
console.log(`Verified ${Object.keys(manifest.files).length-failed}/${Object.keys(manifest.files).length} immutable source/inventory files.`);
if(failed)process.exitCode=1;
