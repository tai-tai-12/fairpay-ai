/** FairPay local-only request boundary.
 * Deny DNS-rebinding Host values, foreign browser Origins, cross-site fetches,
 * and simple form/text POST bodies. An external link may legitimately open
 * a public document with a cross-site top-level GET navigation; the previous
 * blanket Fetch Metadata check incorrectly blocked that harmless action.
 * For local CLI/API tests without Origin, only JSON POST is permitted; this
 * is not an authentication mechanism.
 */
export function requestBoundary(req, port) {
  const host=String(req.headers.host||'').trim().toLowerCase();
  const validHosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
  if(!validHosts.has(host))return {status:403,message:'Request Host is not the local FairPay address.'};
  const origin=req.headers.origin;
  if(origin!==undefined){
    let parsed;
    try{parsed=new URL(origin);}catch{return {status:403,message:'Unrecognized request Origin.'};}
    if(parsed.protocol!=='http:'||parsed.host!==host||parsed.origin!==origin)
      return {status:403,message:'Cross-origin requests are not allowed.'};
  }
  const site=String(req.headers['sec-fetch-site']||'').toLowerCase();
  // Clicking the local app's address from an external site (including a chat)
  // is a cross-site NAVIGATION, not a cross-site API request. Let the browser
  // display public entry points, but never exempt API fetches or writes.
  let pathname;
  try{pathname=new URL(req.url||'/', 'http://localhost').pathname;}catch{pathname='';}
  const publicEntrypoint=pathname==='/'||pathname==='/index.html'||pathname==='/api/health';
  const topLevelNavigation=req.method==='GET'
    && req.headers['sec-fetch-mode']==='navigate'
    && req.headers['sec-fetch-dest']==='document'
    && origin===undefined
    && publicEntrypoint;
  if(site && !['same-origin','none'].includes(site) && !topLevelNavigation)
    return {status:403,message:'Cross-site requests are not allowed.'};
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    const media=String(req.headers['content-type']||'').split(';',1)[0].trim().toLowerCase();
    if(media!=='application/json')return {status:415,message:'Use application/json for local API changes.'};
  }
  return null;
}
