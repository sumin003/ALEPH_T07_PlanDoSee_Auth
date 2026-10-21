'use strict';
// 카드 1~5: 브라우저 보관 + 배포 시 서버 DB 동기화. 서버 미설정이면 로컬 모드임을 명시합니다.
const KEY='plandosee-card1-v1';
const TASK_KEY='plandosee-card2-v1';
const SORT_KEY='plandosee-task-sort-v1';
const initialTitles=['정보처리기사 실기 공부하기','ALEPH 과제 하기','ALEPH 수업 복습하기'];
const $=id=>document.getElementById(id);
const dateLocal=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
let selectedDay=dateLocal();
const seoulDay=iso=>new Date(iso).toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
function dailyCompletion(t,day=selectedDay){return executions.find(l=>l.taskId===t.id&&l.isCompletion&&seoulDay(l.endedAt)===day)}
function taskDone(t,day=selectedDay){return taskInPeriod(t,day)&&Boolean(dailyCompletion(t,day))}
function taskInPeriod(t,day=selectedDay){return (!t.day||t.day<=day)&&(!t.due||day<=t.due)}
function taskDay(t){return t.day||t.due||dateLocal(new Date(t.createdAt||Date.now()));}
function planVisible(p){return (!p.start||p.start<=selectedDay)&&(!p.end||p.end>=selectedDay);}
function changeDay(day){selectedDay=day;$('selectedDay').value=day;render();renderTasks();renderReflections();}
$('selectedDay').value=selectedDay;
$('selectedDay').addEventListener('change',e=>{if(e.target.value)changeDay(e.target.value)});
for(const [id,step] of [['prevDay',-1],['nextDay',1]])$(id).onclick=()=>{const d=new Date(selectedDay+'T12:00:00');d.setDate(d.getDate()+step);changeDay(dateLocal(d));};
$('todayDay').onclick=()=>changeDay(dateLocal());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emptyText=s=>s?esc(s):'<span class="unset">아직 정하지 않았어요</span>';
const snapshot=p=>({title:p.title,start:p.start,end:p.end,success:p.success,minutes:p.minutes});
function load(){return []}
let plans=load(),editingId=null;
// 기존 카드 1 데이터를 보존하면서 안정적인 계획 ID를 부여합니다.
const usedIds=new Set();let migrated=false;
plans.forEach((p,i)=>{let id=p.id;if(/^initial-\d+$/.test(id||'')){id=`PLAN-${String(Number(id.split('-')[1])).padStart(3,'0')}`;}if(!id||usedIds.has(id)){let n=1;while(usedIds.has(`PLAN-${String(n).padStart(3,'0')}`))n++;id=`PLAN-${String(n).padStart(3,'0')}`;}if(p.id!==id){p.id=id;migrated=true;}usedIds.add(id);});
let tasks=[];

// 이후 계획이 추가되어도 기존 ID와 충돌하지 않도록 사용된 번호를 확인합니다.
function nextPlanId(){let n=1;while(plans.some(p=>p.id===`PLAN-${String(n).padStart(3,'0')}`))n++;return `PLAN-${String(n).padStart(3,'0')}`}
function saveTasks(next){if(!remoteReady||!remoteMode)return false;tasks=next;queueRemoteSave();return true}


function persist(){if(!remoteReady||!remoteMode)return false;queueRemoteSave();return true}
function render(){
  $('count').textContent=`${plans.filter(planVisible).length}개의 계획`;
  $('cards').innerHTML=plans.some(planVisible)?plans.filter(planVisible).map((p,i)=>{
    const period=p.start||p.end?`${esc(p.start||'미정')} ~ ${esc(p.end||'미정')}`:'미정';
    const minutes=p.minutes!==null&&p.minutes!==''?`${esc(p.minutes)}분`:'미정';
    return `<article class="plan">
      <div class="plan-top"><span class="number">계획 ID · ${esc(p.id)}</span><span class="status">나의 계획</span></div>
      <h3>${esc(p.title)}</h3>
      <div class="plan-meta"><span>기간 ${period}</span><span class="meta-separator" aria-hidden="true">·</span><span>예상 시간 ${minutes}</span></div>
      <div class="success-note"><span class="field-label">성공 기준</span><p>${emptyText(p.success)}</p></div>
      <div class="task-preview"><div class="task-preview-head"><strong>할 일</strong><span>DO · ${tasks.filter(t=>t.planId===p.id&&taskInPeriod(t)).length}개</span></div><div class="preview-items">${tasks.filter(t=>t.planId===p.id&&taskInPeriod(t)).slice(0,4).map(t=>`<div class="preview-item">${t.done?'☑':'□'} ${esc(t.title)}</div>`).join('')||'<p>아직 등록한 할 일이 없어요.</p>'}</div></div>
      <div class="actions"><button class="secondary" data-action="edit" data-id="${esc(p.id)}">✎ 계획 수정</button><button class="ghost" data-action="history" data-id="${esc(p.id)}">◷ 수정 이력 (${(p.revisions||[]).length})</button></div>
    </article>`;
  }).join(''):'<div class="empty">계획이 아직 없어요. 새 계획을 만들어보세요.</div>';
}
function openEditor(id=null){editingId=id;const p=plans.find(x=>x.id===id);$('dialogTitle').textContent=p?'계획 수정하기':'새 계획 만들기';$('planForm').reset();$('formError').textContent='';$('title').value=p?.title||'';$('start').value=p?.start||selectedDay;$('end').value=p?.end||selectedDay;$('success').value=p?.success||'';$('minutes').value=p?.minutes??'';$('editor').showModal();}
function showHistory(id){const p=plans.find(x=>x.id===id);if(!p)return;$('historyTitle').textContent=`${p.title} · 수정 이력`;const rev=p.revisions||[];$('historyBody').innerHTML=rev.length?rev.slice().reverse().map((r,i)=>`<div class="revision"><strong>수정 ${rev.length-i}회차</strong> <time>${esc(new Date(r.at).toLocaleString('ko-KR'))}</time><p><strong>수정 전</strong> ${esc(r.before.title)}</p><p><strong>수정 후</strong> ${esc(r.after.title)}</p><p>기간: ${esc(r.before.start||'미정')} ~ ${esc(r.before.end||'미정')} → ${esc(r.after.start||'미정')} ~ ${esc(r.after.end||'미정')}</p><p>성공 기준: ${esc(r.before.success||'미정')} → ${esc(r.after.success||'미정')}</p><p>예상 시간: ${esc(r.before.minutes??'미정')} → ${esc(r.after.minutes??'미정')} (분)</p></div>`).join(''):'<p class="empty">아직 수정 이력이 없어요. 계획을 수정하면 변경 전후 내용이 이곳에 남아요.</p>';$('historyDialog').showModal()}
$('cards').addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;if(b.dataset.action==='edit')openEditor(b.dataset.id);else showHistory(b.dataset.id)});
$('addBtn').onclick=()=>openEditor();$('closeBtn').onclick=$('cancelBtn').onclick=()=>$('editor').close();$('historyClose').onclick=$('historyDone').onclick=()=>$('historyDialog').close();
$('planForm').addEventListener('submit',e=>{e.preventDefault();const title=$('title').value.trim(),start=$('start').value,end=$('end').value,success=$('success').value.trim(),raw=$('minutes').value;const minutes=raw===''?null:Number(raw);if(!title){$('formError').textContent='계획 제목을 입력해주세요.';return}if(start&&end&&start>end){$('formError').textContent='종료 날짜는 시작 날짜보다 빠를 수 없어요.';return}if(raw!==''&&(!Number.isSafeInteger(minutes)||minutes<0)){$('formError').textContent='예상 시간은 0 이상의 정수(분)로 입력해주세요.';return}const next={title,start,end,success,minutes};const previous=plans;const copy=structuredClone(plans);if(editingId){const p=copy.find(x=>x.id===editingId);if(!p)return;const before=snapshot(p);if(JSON.stringify(before)!==JSON.stringify(next)){p.revisions??=[];p.revisions.push({at:new Date().toISOString(),before,after:{...next}});Object.assign(p,next)}}else{copy.push({id:nextPlanId(),...next,revisions:[],createdAt:new Date().toISOString()})}plans=copy;if(!persist()){plans=previous;return}render();$('editor').close();renderTasks();refreshPlanOptions()});
render();
refreshPlanOptions();renderTasks();

// 카드 2: 실제 할 일은 사용자 입력 전까지 생성하지 않습니다.
let editingTaskId=null;
function refreshPlanOptions(){
 const filter=$('taskPlanFilter'), selected=filter.value;
 filter.innerHTML='<option value="all">모든 계획</option>'+plans.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} (${esc(p.id)})</option>`).join('');
 filter.value=selected==='all'||plans.some(p=>p.id===selected)?selected:'all';
 $('taskPlan').innerHTML=plans.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} (${esc(p.id)})</option>`).join('');
}
function openTaskEditor(id=null,planId=null){
 editingTaskId=id;const t=tasks.find(t=>t.id===id);
 $('taskDialogTitle').textContent=t?'할 일 수정':'새 할 일';$('taskForm').reset();$('taskError').textContent='';
 $('taskPlan').value=t?.planId||planId||plans[0]?.id||'';
 $('taskTitle').value=t?.title||'';$('taskDay').value=t?taskDay(t):selectedDay;$('taskDue').value=t?.due||'';$('taskHours').value=t?.minutes==null?'':Math.floor(t.minutes/60);$('taskMinutes').value=t?.minutes==null?'':t.minutes%60;
 $('taskPriority').value=t?.priority||'normal';$('taskTags').value=(t?.tags||[]).join(', ');
 $('taskEditor').showModal();
}
function sortTasks(a,b,mode){
 const pri={high:3,normal:2,low:1};let v=0;
 if(mode==='due-asc'||mode==='due-desc'){
  if(!a.due&&!b.due)v=0;else if(!a.due)v=1;else if(!b.due)v=-1;else v=mode==='due-asc'?a.due.localeCompare(b.due):b.due.localeCompare(a.due);
 }else if(mode==='priority-desc')v=pri[b.priority||'normal']-pri[a.priority||'normal'];
 else if(mode==='priority-asc')v=pri[a.priority||'normal']-pri[b.priority||'normal'];
 else if(mode==='title-asc')v=a.title.localeCompare(b.title,'ko');
 else if(mode==='created-asc')v=a.createdAt.localeCompare(b.createdAt);
 else v=b.createdAt.localeCompare(a.createdAt);
 return v||a.id.localeCompare(b.id);
}
function renderTasks(){
 const search=$('taskSearch').value.trim().toLocaleLowerCase('ko');const plan=$('taskPlanFilter').value;
 const status=$('taskStatusFilter').value;const tag=$('taskTagFilter').value.trim().toLocaleLowerCase('ko');const sort=$('taskSort').value;
 const visible=tasks.filter(t=>(plan==='all'||t.planId===plan)&&taskInPeriod(t)&&(status==='all'||(status==='done'?taskDone(t):!taskDone(t)))&&(!search||t.title.toLocaleLowerCase('ko').includes(search))&&(!tag||(t.tags||[]).some(x=>x.toLocaleLowerCase('ko').includes(tag)))).sort((a,b)=>sortTasks(a,b,sort));
 $('taskCount').textContent=`${tasks.length}개`;
 $('taskList').innerHTML=visible.length?visible.map(t=>{
 const p=plans.find(p=>p.id===t.planId);
 return `<article class="task-row ${taskDone(t)?'is-done':''}"><div class="task-main"><label class="task-check"><input type="checkbox" data-action="toggle" data-id="${esc(t.id)}" ${taskDone(t)?'checked':''}><span class="task-title">${esc(t.title)}</span></label><div class="task-detail"><span>${esc(p?.title||'연결 계획 없음')}</span><span>· ${esc(t.due||'마감일 미정')}</span><span>· 예상 ${t.minutes==null?'미정':esc(Math.floor(t.minutes/60))+'시간 '+esc(t.minutes%60)+'분'}</span><span>· ${esc(({high:'높음',normal:'보통',low:'낮음'})[t.priority]||'보통')}</span>${(t.tags||[]).map(tag=>`<span class="task-tag">#${esc(tag)}</span>`).join('')}</div></div><div class="task-buttons"><button class="ghost" data-action="edit" data-id="${esc(t.id)}">수정</button><button class="ghost danger" data-action="delete" data-id="${esc(t.id)}">삭제</button></div></article>`;
 }).join(''):'<div class="empty">조건에 맞는 할 일이 없어요. 실제로 할 일을 정하면 추가해 주세요.</div>';
 renderPlanPreviews();
}
function renderPlanPreviews(){document.querySelectorAll('.plan').forEach((card,i)=>{
 const p=plans.filter(planVisible)[i];if(!p)return;const list=tasks.filter(t=>t.planId===p.id&&taskInPeriod(t)).sort((a,b)=>sortTasks(a,b,'priority-desc'));
 card.querySelector('.task-preview-head span').textContent=`DO · ${list.length}개`;
 card.querySelector('.preview-items').innerHTML=list.length?list.slice(0,4).map(t=>`<div class="preview-item ${taskDone(t)?'done':''}">${taskDone(t)?'☑':'□'} ${esc(t.title)}</div>`).join('')+(list.length>4?`<p>외 ${list.length-4}개</p>`:''):'<p>아직 등록한 할 일이 없어요.</p>';
 });}
$('addTaskBtn').onclick=()=>openTaskEditor();
$('taskClose').onclick=$('taskCancel').onclick=()=>$('taskEditor').close();
$('taskForm').addEventListener('submit',e=>{
 e.preventDefault();const title=$('taskTitle').value.trim(),planId=$('taskPlan').value,due=$('taskDue').value,raw=$('taskMinutes').value,rawHours=$('taskHours').value;
 
 const minutes=raw===''&&rawHours===''?null:Number(rawHours||0)*60+Number(raw||0),priority=$('taskPriority').value,tags=[...new Set($('taskTags').value.split(',').map(s=>s.trim()).filter(Boolean))];
 if(!plans.some(p=>p.id===planId)){$('taskError').textContent='연결할 계획을 선택해주세요.';return}
 if(!title){$('taskError').textContent='할 일 내용을 입력해주세요.';return}
 if((raw!==''||rawHours!=='')&&(!Number.isSafeInteger(minutes)||minutes<0||!Number.isSafeInteger(Number(raw||0))||Number(raw||0)>59||!Number.isSafeInteger(Number(rawHours||0)))){$('taskError').textContent='예상 시간은 0 이상의 정수로 입력해주세요.';return}
 if(tags.some(t=>t.length>30)){$('taskError').textContent='태그는 각각 30자 이내로 입력해주세요.';return}
 const next=structuredClone(tasks),now=new Date().toISOString(),day=$('taskDay').value||selectedDay;
 if(editingTaskId){const t=next.find(t=>t.id===editingTaskId);if(!t)return;Object.assign(t,{planId,title,day,due,minutes,priority,tags,updatedAt:now});}
 else next.push({id:crypto.randomUUID(),planId,title,day,due,minutes,priority,tags,done:false,createdAt:now,updatedAt:now});
 if(saveTasks(next)){$('taskEditor').close();renderTasks();}
});
$('taskList').addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;const t=tasks.find(t=>t.id===b.dataset.id);if(!t)return;
 if(b.dataset.action==='edit')openTaskEditor(t.id);
 if(b.dataset.action==='delete'&&confirm(`「${t.title}」 할 일을 삭제할까요?`)){if(saveTasks(tasks.filter(x=>x.id!==t.id)))renderTasks();}
});
let completingTaskId=null;
function completionRange(){const a=new Date($('completeStart').value),b=new Date($('completeEnd').value);return Number.isFinite(a.getTime())&&Number.isFinite(b.getTime())&&b>a?{startedAt:a.toISOString(),endedAt:b.toISOString(),elapsedMs:b-a}:null;}
function openCompletion(id){
 const task=tasks.find(t=>t.id===id);if(!task)return;
 completingTaskId=id;$('completionTaskName').textContent=task.title;
 const previous=dailyCompletion(task);
 const now=localDateTimeValue();
 $('completeStart').value=previous?localDateTimeValue(new Date(previous.startedAt)):now;
 $('completeEnd').value=previous?localDateTimeValue(new Date(previous.endedAt)):now;
 $('completeReason').value=previous?.reason||'';$('completeError').textContent='';
 updateCompletionDuration();$('completionDialog').showModal();
}
function updateCompletionDuration(){$('completeDuration').textContent=completionRange()?durationText(completionRange().elapsedMs):'종료 시각을 시작 시각보다 늦게 입력해 주세요.';}
['completeStart','completeEnd'].forEach(id=>$(id).addEventListener('input',updateCompletionDuration));
$('completionClose').onclick=$('completionCancel').onclick=()=>$('completionDialog').close();
$('taskList').addEventListener('change',e=>{
 const input=e.target.closest('input[data-action="toggle"]');if(!input)return;
 const task=tasks.find(t=>t.id===input.dataset.id);if(!task)return;
 if(!taskDone(task)){input.checked=false;openCompletion(task.id);return;}
 if(!confirm('완료를 취소할까요? 실행 기록은 남겨둡니다.')){input.checked=true;return;}
 const next=structuredClone(tasks),t=next.find(x=>x.id===task.id);
 const existing=dailyCompletion(t);if(!existing){input.checked=true;return;}
 if(!remoteReady||!remoteMode){input.checked=true;return;}
 executions=executions.filter(l=>l.id!==existing.id);
 t.done=false;t.completedAt=null;
 t.updatedAt=new Date().toISOString();
 if(saveTasks(next)){renderTasks();renderReflections()}else input.checked=true;
});
$('completionForm').addEventListener('submit',e=>{
 e.preventDefault();const range=completionRange(),task=tasks.find(t=>t.id===completingTaskId);
 if(!range||!task){$('completeError').textContent='시작·종료 시각을 확인해 주세요.';return;}
 const plan=plans.find(p=>p.id===task.planId),now=new Date().toISOString();
 if(seoulDay(range.endedAt)!==selectedDay){$('completeError').textContent='매일 반복 할 일의 종료 날짜는 현재 선택한 날짜와 같아야 해요.';return;}
 const nextLogs=structuredClone(executions),old=nextLogs.find(l=>l.taskId===task.id&&l.isCompletion&&(seoulDay(l.endedAt)===seoulDay(range.endedAt)));
 const log={taskId:task.id,planId:task.planId,taskTitle:task.title,planTitle:plan?.title||'',...range,reason:$('completeReason').value.trim(),isCompletion:true};
 if(old)Object.assign(old,log);else nextLogs.push({id:crypto.randomUUID(),...log});
 const nextTasks=structuredClone(tasks),updated=nextTasks.find(t=>t.id===task.id);
 updated.done=true;updated.completedAt=range.endedAt;updated.updatedAt=now;
 try{
  if(!remoteReady||!remoteMode)throw Error('server_unavailable');

  executions=nextLogs;tasks=nextTasks;queueRemoteSave();
  $('completionDialog').close();render();renderTasks();renderExecutions();renderReflections();
 }catch(error){$('completeError').textContent='기록을 저장하지 못했어요.';}
});
['taskSearch','taskPlanFilter','taskStatusFilter','taskTagFilter'].forEach(id=>$(id).addEventListener(id==='taskPlanFilter'||id==='taskStatusFilter'?'change':'input',renderTasks));

$('taskSort').addEventListener('change',renderTasks);
renderTasks();


// 카드 3: 계획/할 일과 분리된 실행 기록. 로컬 시제품이며 서버 DB 저장은 아직 아닙니다.
const EXEC_KEY='plandosee-card3-executions-v1';
const ACTIVE_KEY='plandosee-card3-active-v1';
function readLocal(key,fallback){return fallback}
let executions=readLocal(EXEC_KEY,[]);
if(!Array.isArray(executions))executions=[];
const timeText=iso=>new Date(iso).toLocaleString('ko-KR');
const elapsedMs=(start,end)=>Math.max(0,new Date(end).getTime()-new Date(start).getTime());
function durationText(ms){const minutes=Math.floor(ms/60000);return `${Math.floor(minutes/60)}시간 ${minutes%60}분`}
function refreshExecutionTasks(){
 const select=$('executionTask'),previous=select.value;
 select.innerHTML=tasks.map(t=>`<option value="${esc(t.id)}">${esc((plans.find(p=>p.id===t.planId)?.title||'연결 계획 없음')+' / '+t.title)}</option>`).join('');
 if(tasks.some(t=>t.id===previous))select.value=previous;
 $('executionSave').disabled=!tasks.length;
}
function renderExecutions(){
 $('executionCount').textContent=`${executions.length}건의 기록`;
 $('executionList').innerHTML=executions.length?executions.slice().sort((a,b)=>b.endedAt.localeCompare(a.endedAt)).map(log=>{
 const t=tasks.find(t=>t.id===log.taskId),p=plans.find(p=>p.id===log.planId);
 return `<article class="execution-item"><strong>${esc(log.taskTitle||t?.title||'삭제된 할 일')}</strong><p>계획: ${esc(log.planTitle||p?.title||log.planId||'미정')}</p><p>시작 ${esc(timeText(log.startedAt))}</p><p>종료 ${esc(timeText(log.endedAt))}</p><p>실제 소요 ${esc(durationText(log.elapsedMs))}</p><p class="reason">막힌 이유: ${esc(log.reason||'없음')}</p><button type="button" class="secondary" data-edit-execution="${esc(log.id)}">수정</button></article>`;
 }).join(''):'<div class="execution-empty">아직 실행 기록이 없어요. 실제로 한 일을 입력해 보세요.</div>';
}
function manualRange(){
 const start=$('executionStartAt').value,end=$('executionEndAt').value;
 if(!start||!end)return null;
 const a=new Date(start),b=new Date(end);
 if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||b<=a)return null;
 return {startedAt:a.toISOString(),endedAt:b.toISOString(),elapsedMs:b.getTime()-a.getTime()};
}
function updateManualDuration(){
 const range=manualRange();
 $('executionDuration').textContent=range?durationText(range.elapsedMs):'올바른 시작·종료 시각을 입력해 주세요';
}
// 날짜/시각은 UTC 문자열이 아닌 사용자의 로컬 시간으로 입력합니다.
function localDateTimeValue(date=new Date()){
 const pad=n=>String(n).padStart(2,'0');
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fillCurrentExecutionTime(){
 const now=new Date();
 
 $('executionStartAt').value=localDateTimeValue(now);
 $('executionEndAt').value=localDateTimeValue(now);
 updateManualDuration();
}
$('executionNow').addEventListener('click',fillCurrentExecutionTime);
['executionStartAt','executionEndAt'].forEach(id=>$(id).addEventListener('input',updateManualDuration));
fillCurrentExecutionTime();
let editingExecutionId=null;
$('executionList').addEventListener('click',e=>{
 const button=e.target.closest('button[data-edit-execution]');if(!button)return;
 const log=executions.find(x=>x.id===button.dataset.editExecution);if(!log)return;
 editingExecutionId=log.id;
 $('executionTask').value=log.taskId;
 $('executionStartAt').value=localDateTimeValue(new Date(log.startedAt));
 $('executionEndAt').value=localDateTimeValue(new Date(log.endedAt));
 $('executionReason').value=log.reason||'';
 $('executionSave').textContent='수정 저장';
 $('executionError').textContent='';
 updateManualDuration();
 $('executionStartAt').focus();
});
let savingExecution=false;
$('executionSave').addEventListener('click',()=>{
 if(savingExecution)return;
 const task=tasks.find(t=>t.id===$('executionTask').value),range=manualRange();
 if(!task){$('executionError').textContent='실행한 할 일을 선택해 주세요.';return}
 if(!range){$('executionError').textContent='종료 시각은 시작 시각보다 늦어야 해요.';return}
 const plan=plans.find(p=>p.id===task.planId);
 const log={id:editingExecutionId||crypto.randomUUID(),taskId:task.id,planId:task.planId,taskTitle:task.title,planTitle:plan?.title||'',...range,reason:$('executionReason').value.trim()};
 savingExecution=true;$('executionSave').disabled=true;
 try{
   const next=editingExecutionId?executions.map(x=>x.id===editingExecutionId?{...x,...log}:x):[...executions,log];
   if(!remoteReady||!remoteMode)throw Error('server_unavailable');executions=next;
   if(editingExecutionId){
    const changed=next.find(x=>x.id===editingExecutionId);
    if(changed?.isCompletion){
     const nextTasks=structuredClone(tasks),linked=nextTasks.find(x=>x.id===changed.taskId);
     if(linked&&linked.done){linked.completedAt=changed.endedAt;linked.updatedAt=new Date().toISOString();tasks=nextTasks;}
    }
   }
   editingExecutionId=null;$('executionSave').textContent='실행 기록 저장';
   queueRemoteSave();
   fillCurrentExecutionTime();$('executionReason').value='';$('executionError').textContent='';
   updateManualDuration();renderExecutions();
 }catch(e){$('executionError').textContent='실행 기록을 저장하지 못했어요.'}
 finally{savingExecution=false;refreshExecutionTasks()}
});
const executionTaskObserver=new MutationObserver(()=>refreshExecutionTasks());
executionTaskObserver.observe($('taskList'),{childList:true});
refreshExecutionTasks();renderExecutions();updateManualDuration();

// 카드 4: 돌아보기. 브라우저 저장 시제품. 서버 DB 집계로 교체해야 합니다.
const REFLECTION_KEY='plandosee-card4-reflections-v1';
let reflections=readLocal(REFLECTION_KEY,[]);
if(!Array.isArray(reflections))reflections=[];
const dayOf=iso=>String(iso||'').slice(0,10);
const localDay=iso=>{const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dayIn=(date,from,to)=>!!date&&(!from||date>=from)&&(!to||date<=to);
const fmtMinutes=mins=>{if(!Number.isFinite(mins))return '0분';const rounded=Math.round(Math.abs(mins));const hours=Math.floor(rounded/60),minutes=rounded%60;return hours?`${hours}시간${minutes?' '+minutes+'분':''}`:`${minutes}분`;};
function updateReflectionOptions(){
 for(const id of ['reflectionPlan','reflectionNextPlan']){
  const select=$(id),prev=select.value;
  select.innerHTML=(id==='reflectionPlan'?'<option value="all">모든 계획</option>':'<option value="">선택하지 않음</option>')+plans.map(p=>`<option value="${esc(p.id)}">${esc(p.title)} (${esc(p.id)})</option>`).join('');
  if([...select.options].some(o=>o.value===prev))select.value=prev;
 }
}
let seeActiveGroup='seePlanned';
function reflectionSelection(){
 const planId=$('reflectionPlan').value,from=$('reflectionFrom').value,to=$('reflectionTo').value;
 const selected=tasks.filter(t=>(planId==='all'||t.planId===planId)&&(!from||!t.due||t.due>=from)&&(!to||!t.day||t.day<=to));
 const ids=new Set(selected.map(t=>t.id));
 const logs=executions.filter(l=>ids.has(l.taskId)&&dayIn(localDay(l.startedAt),from,to));
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
 const done=selected.filter(t=>taskDone(t,from&&to&&from===to?from:selectedDay));
 const late=selected.filter(t=>!taskDone(t)&&t.due&&t.due<today);
 const blockedIds=new Set(logs.filter(l=>l.reason&&l.reason.trim()).map(l=>l.taskId));
 const blocked=selected.filter(t=>blockedIds.has(t.id));
 const groups={seePlanned:selected,seeDone:done,seeLate:late,seeBlocked:blocked};
 const focus=groups[seeActiveGroup]||selected;
 const focusIds=new Set(focus.map(t=>t.id));
 const focusLogs=logs.filter(l=>focusIds.has(l.taskId));
 return {selected,logs,done,late,blocked,focus,focusLogs};
}
function renderReflections(){
 updateReflectionOptions();
 const from=$('reflectionFrom').value,to=$('reflectionTo').value;
 $('reflectionError').textContent=from&&to&&from>to?'시작 날짜는 종료 날짜보다 늦을 수 없어요.':'';
 const {selected,logs,done,late,blocked,focus,focusLogs}=reflectionSelection();
 const estimated=focus.reduce((n,t)=>n+(t.minutes!==null&&Number.isFinite(Number(t.minutes))?Number(t.minutes):0),0);
 const actual=focusLogs.reduce((n,l)=>n+(Number(l.elapsedMs)||0),0)/60000;
 $('seeFocusLabel').textContent=`현재 시간 비교 대상: ${({seePlanned:'전체 할 일',seeDone:'완료한 일',seeLate:'지연된 일',seeBlocked:'막힌 일'})[seeActiveGroup]} ${focus.length}개`;
 document.querySelectorAll('[data-see-detail]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.seeDetail===seeActiveGroup)));
 $('seePlanned').textContent=selected.length;$('seeDone').textContent=done.length;
 $('seeLate').textContent=late.length;$('seeBlocked').textContent=blocked.length;
 $('seeEstimated').textContent=fmtMinutes(estimated);$('seeActual').textContent=fmtMinutes(actual);
 const max=Math.max(estimated,actual,1);
 $('seeEstimatedBar').style.width=`${estimated/max*100}%`;
 $('seeActualBar').style.width=`${actual/max*100}%`;
 $('seeDifference').textContent=`실제 − 예상: ${actual-estimated<0?'-':'+'}${fmtMinutes(Math.abs(actual-estimated))} · 예상 시간을 입력하지 않은 할 일은 0분으로 계산해요.`;
 $('seeBlockedList').innerHTML='<strong>막힌 이유가 있는 일</strong>'+(blocked.length?'<ul>'+blocked.map(t=>`<li>${esc(t.title)}: ${esc(logs.filter(l=>l.taskId===t.id&&l.reason?.trim()).map(l=>l.reason).join(' / '))}</li>`).join('')+'</ul>':'<p>기록된 막힌 이유가 없어요.</p>');
 $('seeLateList').innerHTML='<strong>지연된 일</strong>'+(late.length?'<ul>'+late.map(t=>`<li>${esc(t.title)} · 마감 ${esc(t.due)}</li>`).join('')+'</ul>':'<p>확인된 지연 항목이 없어요.</p>');
 $('seeEvidencePanel').hidden=true;
 const visibleReflections=reflections.filter(r=>($('reflectionNextPlan').value||'')===(r.nextPlanId||''));
 $('reflectionEntries').innerHTML=visibleReflections.length?visibleReflections.slice().reverse().map(r=>`<div class="reflection-entry"><button type="button" class="ghost" data-delete-reflection="${esc(r.id)}">삭제</button><small>${esc(new Date(r.createdAt).toLocaleString('ko-KR'))} · ${esc(r.sourcePlanTitle||'모든 계획')} → ${esc(r.nextPlanTitle||'다음 계획 미지정')}</small><p>${esc(r.text)}</p>${r.nextPlanId?`<p class="helper">다음 계획으로 넘긴 개선 메모: <strong>${esc(r.text)}</strong></p>`:''}</div>`).join(''):'<p class="helper">아직 저장된 돌아보기가 없어요.</p>';
}
const evidenceNames={seePlanned:'계획에 딸린 할 일',seeDone:'완료한 일',seeLate:'지연된 일',seeBlocked:'막힌 일',seeEstimated:'예상 시간',seeActual:'실제 시간'};
document.querySelectorAll('[data-see-detail]').forEach(b=>b.addEventListener('click',()=>{
 const key=b.dataset.seeDetail;
 if(['seePlanned','seeDone','seeLate','seeBlocked'].includes(key))seeActiveGroup=key;
 renderReflections();
 const {focus,focusLogs}=reflectionSelection();
 const lines=key==='seeActual'?focusLogs.map(l=>`${l.taskTitle||tasks.find(t=>t.id===l.taskId)?.title||'연결된 할 일 없음'} · ${durationText(l.elapsedMs)} · ${new Date(l.startedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}`):focus.map(t=>`${t.title} · 예상 ${fmtMinutes(Number(t.minutes)||0)}`);
 $('seeEvidencePanel').hidden=false;
 $('seeEvidence').innerHTML='<strong>'+esc(evidenceNames[key]||'집계')+'의 근거</strong>'+(lines.length?'<ul>'+lines.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>해당 기록이 없어요.</p>');
 $('seeEvidence').scrollIntoView({behavior:'smooth',block:'nearest'});
}));
['reflectionPlan','reflectionFrom','reflectionTo','reflectionNextPlan'].forEach(id=>$(id).addEventListener('change',renderReflections));
$('reflectionReset').onclick=()=>{$('reflectionFrom').value='';$('reflectionTo').value='';renderReflections()};
$('reflectionSave').onclick=()=>{
 const text=$('reflectionText').value.trim(),source=$('reflectionPlan').value,next=$('reflectionNextPlan').value;
 if(!text){$('reflectionSaveStatus').textContent='돌아보기 메모를 먼저 입력해주세요.';return}
 if(text.length>3000){$('reflectionSaveStatus').textContent='메모는 3000자 이내로 입력해주세요.';return}
 const entry={id:crypto.randomUUID(),text,sourcePlanId:source,sourcePlanTitle:source==='all'?'모든 계획':plans.find(p=>p.id===source)?.title||'',nextPlanId:next||null,nextPlanTitle:plans.find(p=>p.id===next)?.title||'',from:$('reflectionFrom').value,to:$('reflectionTo').value,createdAt:new Date().toISOString()};
 try{const data=[...reflections,entry];if(!remoteReady||!remoteMode)throw Error('server_unavailable');reflections=data;queueRemoteSave();$('reflectionText').value='';$('reflectionSaveStatus').textContent='서버에 저장하는 중…';renderReflections()}
 catch(e){$('reflectionSaveStatus').textContent='저장에 실패했어요. 브라우저 저장 공간을 확인해주세요.'}
};
$('reflectionEntries').addEventListener('click',e=>{const b=e.target.closest('[data-delete-reflection]');if(!b||!confirm('이 돌아보기 메모를 삭제할까요?'))return;const data=reflections.filter(r=>r.id!==b.dataset.deleteReflection);try{if(!remoteReady||!remoteMode)throw Error('server_unavailable');reflections=data;queueRemoteSave();renderReflections()}catch(e){$('reflectionSaveStatus').textContent='삭제 저장에 실패했어요.'}});
const originalRenderTasks=renderTasks;
renderTasks=function(){originalRenderTasks();renderReflections()};
const originalRenderExecutions=renderExecutions;
renderExecutions=function(){originalRenderExecutions();renderReflections()};
renderReflections();


// 카드 5: JSON 내보내기 및 서버 DB 동기화.
// 서버 저장은 /api/state에서 Supabase 서비스 키로만 수행하며 브라우저에는 키를 전달하지 않습니다.
let remoteReady=false,remoteMode=false,remoteBusy=false,remotePending=false;
const cloudStatus=$('cloudStatus');
cloudStatus.classList.remove('visually-hidden');
cloudStatus.style.cssText='display:block;margin:12px 0;font-size:13px;color:#356d94';
function fullData(){return {schemaVersion:2,exportedAt:new Date().toISOString(),plans:structuredClone(plans),tasks:structuredClone(tasks),executions:structuredClone(executions),reflections:structuredClone(reflections)};}
function setCloudStatus(message){cloudStatus.textContent=message;const error=$('cloudError');error.hidden=true;error.textContent='';}
function lockEditing(locked){document.querySelectorAll('button,input,textarea,select').forEach(el=>{if(['exportAll','selectedDay','prevDay','nextDay','todayDay'].includes(el.id))return;if(locked){if(!el.disabled)el.dataset.dbLock='1';el.disabled=true;}else if(el.dataset.dbLock==='1'){el.disabled=false;delete el.dataset.dbLock;}});}
let remoteTimer,confirmedState=null;
function applyState(state){plans=structuredClone(state.plans);tasks=structuredClone(state.tasks);executions=structuredClone(state.executions);reflections=structuredClone(state.reflections);render();renderTasks();refreshPlanOptions();refreshExecutionTasks();renderExecutions();renderReflections();}
function queueRemoteSave(){if(!remoteReady||!remoteMode)return;clearTimeout(remoteTimer);remoteTimer=setTimeout(saveRemote,350);}
async function saveRemote(){
 if(!remoteMode)return;
 if(remoteBusy){remotePending=true;return;}
 remoteBusy=true;lockEditing(true);setCloudStatus('서버 DB에 저장 중…');
 const payload=fullData();
 try{
  const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  confirmedState=payload;setCloudStatus('서버 DB 저장 완료 · 다른 창에서도 확인할 수 있어요.');
  $('reflectionSaveStatus').textContent='서버 DB 저장 완료';
 }catch(error){
  if(confirmedState)applyState(confirmedState);
  setCloudStatus('서버 저장 실패 · 변경 사항을 되돌렸어요.');
  $('reflectionSaveStatus').textContent='서버 저장 실패';
  remotePending=false;remoteMode=false;remoteReady=false;
 }finally{remoteBusy=false;if(remoteMode)lockEditing(false);if(remotePending&&remoteMode){remotePending=false;queueRemoteSave();}}
}
async function initRemote(){
 lockEditing(true);setCloudStatus('서버 DB에서 불러오는 중…');
 try{
  const response=await fetch('/api/state',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const result=await response.json();
  if(!result.state||!['plans','tasks','executions','reflections'].every(k=>Array.isArray(result.state[k])))throw Error('Server data missing or invalid');
  applyState(result.state);
  confirmedState=fullData();
  remoteMode=true;remoteReady=true;
  lockEditing(false);setCloudStatus('서버 DB에서 기록을 불러왔어요.');
 }catch(error){
  remoteMode=false;remoteReady=false;lockEditing(true);
  setCloudStatus('서버 DB 연결 실패 · 기존 기록 보호를 위해 수정할 수 없어요.');
 }
}
$('exportAll').addEventListener('click',()=>{
 const json=JSON.stringify(fullData(),null,2);
 const blob=new Blob([json],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='plandosee-all-data-'+localDateTimeValue().slice(0,10)+'.json';
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('exportStatus').textContent='계획·할 일·실행 기록·돌아보기를 JSON 파일 하나로 내보냈어요.';
});

function renderCard5Counts(){
 $('card5PlanCount').textContent=plans.length;
 $('card5TaskCount').textContent=tasks.length;
 $('card5ExecutionCount').textContent=executions.length;
 $('card5ReflectionCount').textContent=reflections.length;
 $('card5ActualStatus').textContent=executions.length>=3?'실행 기록 3건 이상 등록됨':'실제 실행 기록을 '+(3-executions.length)+'건 더 입력해야 해요.';
}
const card5OriginalRender=render;
render=function(){card5OriginalRender();renderCard5Counts();};
const card5OriginalTasks=renderTasks;
renderTasks=function(){card5OriginalTasks();renderCard5Counts();};
const card5OriginalExec=renderExecutions;
renderExecutions=function(){card5OriginalExec();renderCard5Counts();};
renderCard5Counts();initRemote();
