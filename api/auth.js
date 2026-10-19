const URL=process.env.SUPABASE_URL;
const ANON=process.env.SUPABASE_ANON_KEY;
const COOKIE='pds_access',REFRESH='pds_refresh';
function sameOrigin(req){const host=req.headers['x-forwarded-host']||req.headers.host;const origin=req.headers.origin;return Boolean(host&&origin&&(origin===`https://${host}`||(process.env.NODE_ENV!=='production'&&origin===`http://${host}`)));}
const secure=process.env.NODE_ENV==='production'?'; Secure':'';
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${maxAge}${secure}`;}
function clear(res){res.setHeader('Set-Cookie',[cookie(COOKIE,'',0),cookie(REFRESH,'',0)]);}
function save(res,s){res.setHeader('Set-Cookie',[cookie(COOKIE,s.access_token,Math.max(1,s.expires_in||3600)),cookie(REFRESH,s.refresh_token,60*60*24*30)]);}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x[0]).map(([k,v])=>[k,decodeURIComponent(v||'')]));}
async function auth(path,body,token){return fetch(`${URL}/auth/v1/${path}`,{method:body?'POST':'GET',headers:{apikey:ANON,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});}
async function getSession(req,res){
 const c=cookies(req);
 if(c[COOKIE]){const r=await auth('user',null,c[COOKIE]);if(r.ok){const u=await r.json();return {id:u.id,email:u.email,token:c[COOKIE]};}}
 if(!c[REFRESH])return null;
 const r=await auth('token?grant_type=refresh_token',{refresh_token:c[REFRESH]});
 if(!r.ok){clear(res);return null;}
 const s=await r.json();save(res,s);
 const u=await auth('user',null,s.access_token);
 if(!u.ok){clear(res);return null;}
 const user=await u.json();return {id:user.id,email:user.email,token:s.access_token};
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!URL||!ANON)return res.status(503).json({error:'auth_not_configured'});
 try{
  if(req.method==='GET'){
   const user=await getSession(req,res);
   return user?res.status(200).json({user:{id:user.id,email:user.email}}):res.status(401).json({error:'not_authenticated'});
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).end();}
  if(!sameOrigin(req))return res.status(403).json({error:'invalid_origin'});
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(b.action==='logout'){try{const c=cookies(req);if(c[COOKIE])await fetch(`${URL}/auth/v1/logout`,{method:'POST',headers:{apikey:ANON,Authorization:`Bearer ${c[COOKIE]}`}});}catch{}clear(res);return res.status(200).json({ok:true});}
  if(!['login','signup'].includes(b.action))return res.status(400).json({error:'invalid_action'});
  if(typeof b.email!=='string'||typeof b.password!=='string'||b.email.length>254||b.password.length<8||b.password.length>128)return res.status(400).json({error:'invalid_credentials_format'});
  const r=await auth(b.action==='signup'?'signup':'token?grant_type=password',{email:b.email.trim(),password:b.password});
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
   if(b.action==='signup')console.warn('signup_status',r.status,'signup_code',typeof data.code==='string'&&/^[a-z_]{1,50}$/.test(data.code)?data.code:'unavailable');
   if(b.action==='login')return res.status(401).json({error:'invalid_login'});
   // Expose only a tightly controlled diagnostic code, never provider messages or credentials.
   const allowed=new Set(['email_address_invalid','weak_password','email_provider_disabled','signup_disabled','email_exists','over_email_send_rate_limit','over_request_rate_limit','validation_failed']);
   const code=typeof data.code==='string'&&allowed.has(data.code)?data.code:'signup_failed';
   return res.status(r.status===429?429:400).json({error:code});
  }
  if(data.access_token&&data.refresh_token){save(res,data);return res.status(200).json({ok:true,user:{id:data.user?.id,email:data.user?.email}});}
  return res.status(202).json({ok:true,confirmationRequired:true});
 }catch(e){console.error('pds_auth_error',e.message);return res.status(502).json({error:'auth_unavailable'});}
};
module.exports.getSession=getSession;