const {getSession}=require('./auth');
const URL=process.env.SUPABASE_URL,ANON=process.env.SUPABASE_ANON_KEY;
const headers=token=>({apikey:ANON,Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
const sameOrigin=req=>{const host=req.headers['x-forwarded-host']||req.headers.host;const origin=req.headers.origin;return Boolean(host&&origin&&(origin===`https://${host}`||(process.env.NODE_ENV!=='production'&&origin===`http://${host}`)));};
const blank=()=>({plans:[],tasks:[],executions:[],reflections:[]});
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'method_not_allowed'});}
 if(!URL||!ANON)return res.status(503).json({error:'database_not_configured'});
 if(req.method==='PUT'&&!sameOrigin(req))return res.status(403).json({error:'invalid_origin'});
 try{
  const user=await getSession(req,res);
  if(!user)return res.status(401).json({error:'not_authenticated'});
  const endpoint=`${URL}/rest/v1/pds_user_state?user_id=eq.${encodeURIComponent(user.id)}`;
  if(req.method==='GET'){
   const r=await fetch(endpoint+'&select=data',{headers:headers(user.token)});
   if(!r.ok)throw Error(`DB ${r.status}`);
   const rows=await r.json();return res.status(200).json({state:rows[0]?.data||blank()});
  }
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(!body||!['plans','tasks','executions','reflections'].every(k=>Array.isArray(body[k])))return res.status(400).json({error:'invalid_data'});
  if(JSON.stringify(body).length>1500000)return res.status(413).json({error:'data_too_large'});
  const completions=body.executions.filter(x=>x.isCompletion).map(x=>`${x.taskId}:${new Date(x.endedAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})}`);
  if(new Set(completions).size!==completions.length)return res.status(409).json({error:'duplicate_completion'});
  const r=await fetch(`${URL}/rest/v1/pds_user_state?on_conflict=user_id`,{method:'POST',headers:{...headers(user.token),'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:user.id,data:body,updated_at:new Date().toISOString()})});
  if(!r.ok)throw Error(`DB ${r.status}`);return res.status(200).json({ok:true});
 }catch(e){console.error('pds_database_error',e.message);return res.status(502).json({error:'database_error'});}
};