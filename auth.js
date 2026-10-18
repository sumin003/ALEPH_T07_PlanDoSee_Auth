'use strict';
const authView=document.getElementById('authView');
const diaryView=document.getElementById('diaryView');
const authForm=document.getElementById('authForm');
const authMessage=document.getElementById('authMessage');
let mode='login';
async function request(url,options){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const data=await r.json().catch(()=>({}));return {r,data};}
function showAuth(){diaryView.hidden=true;authView.hidden=false;}
function showDiary(user){authView.hidden=true;diaryView.hidden=false;document.getElementById('authUser').textContent=user?.email||'';
 if(!window.__diaryLoaded){window.__diaryLoaded=true;const s=document.createElement('script');s.src='script.js';document.body.appendChild(s);}}
async function check(){try{const {r,data}=await request('/api/auth');if(r.ok&&data.user)showDiary(data.user);else showAuth();}catch{showAuth();authMessage.textContent='인증 서버에 연결할 수 없어요.';}}
authForm.addEventListener('submit',async e=>{e.preventDefault();authMessage.textContent='확인 중…';const btn=authForm.querySelector('button[type=submit]');btn.disabled=true;try{const {r,data}=await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,email:document.getElementById('authEmail').value,password:document.getElementById('authPassword').value})});document.getElementById('authPassword').value='';if(!r.ok){authMessage.textContent=mode==='login'?'로그인 정보를 확인해 주세요.':'회원가입을 완료하지 못했어요.';return;}if(data.confirmationRequired){authMessage.textContent='이메일 인증을 완료한 뒤 로그인해 주세요.';return;}await check();}catch{authMessage.textContent='요청 중 오류가 발생했어요.';}finally{btn.disabled=false;}});
document.getElementById('authSwitch').addEventListener('click',()=>{mode=mode==='login'?'signup':'login';document.getElementById('authTitle').textContent=mode==='login'?'로그인':'회원가입';document.getElementById('authSubmit').textContent=mode==='login'?'로그인':'회원가입';document.getElementById('authSwitch').textContent=mode==='login'?'계정이 없나요? 회원가입':'이미 계정이 있나요? 로그인';authMessage.textContent='';});
document.getElementById('logoutBtn').addEventListener('click',async()=>{try{await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}finally{location.reload();}});
check();