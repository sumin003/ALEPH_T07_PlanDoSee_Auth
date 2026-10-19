// One-time, non-destructive T06 -> T07 migration. Node.js 18+.
// Required env: SUPABASE_URL, SUPABASE_SECRET_KEY, T07_USER_ID
// Default is a dry run. Set CONFIRM_T07_MIGRATION=YES to copy.
const {SUPABASE_URL,SUPABASE_SECRET_KEY,T07_USER_ID}=process.env;
if(!SUPABASE_URL||!SUPABASE_SECRET_KEY||!T07_USER_ID)throw Error('Missing migration environment variables');
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(T07_USER_ID))throw Error('Invalid T07_USER_ID');
const base=new URL(SUPABASE_URL).origin;
const headers={apikey:SUPABASE_SECRET_KEY,Authorization:`Bearer ${SUPABASE_SECRET_KEY}`,'Content-Type':'application/json'};
async function query(path,options={}){const response=await fetch(base+path,{headers,...options});if(!response.ok)throw Error('Supabase request failed: '+response.status);return response.status===204?null:response.json();}
const source=await query('/rest/v1/pds_state?id=eq.main&select=data');
if(source.length!==1||!source[0].data)throw Error('T06 source not found');
const data=source[0].data;
if(!['plans','tasks','executions','reflections'].every(k=>Array.isArray(data[k])))throw Error('Invalid T06 state');
await query('/auth/v1/admin/users/'+T07_USER_ID);
const target=await query('/rest/v1/pds_user_state?user_id=eq.'+T07_USER_ID+'&select=user_id');
if(target.length)throw Error('T07 account already has data; refusing overwrite');
console.log('Dry run OK: source exists, target account exists, destination is empty.');
if(process.env.CONFIRM_T07_MIGRATION!=='YES')process.exit(0);
await query('/rest/v1/pds_user_state',{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({user_id:T07_USER_ID,data,updated_at:new Date().toISOString()})});
console.log('Copied T06 state to T07 account. T06 source unchanged.');