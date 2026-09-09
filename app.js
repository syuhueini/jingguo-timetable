/* v2026.09.09-3｜桃園市立經國國民中學｜課表查詢前端
 * 班級：可同時查詢 1～4 班。
 * 教師：科目可複選；每科可選 0～多位教師；不同科目的教師可自由混選。
 */
let scheduleData = [];
let homeroomData = {};
let subjectTeachers = {};
let navHistory = [];
const DAYS = ['一','二','三','四','五'];
const PERIODS = [0,1,2,3,4,5,6,7,8];
const MAX_CLASS_SELECTIONS = 4;
const MAX_TEACHER_SELECTIONS = 10;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function splitCSVLine(line) {
  const out=[]; let cur=''; let q=false;
  for (const ch of line) {
    if (ch==='"') q=!q;
    else if (ch===',' && !q) { out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur); return out;
}
function parseCSV(text) {
  const lines=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n').filter(x=>x.trim());
  if (!lines.length) return [];
  const headers=splitCSVLine(lines[0]);
  return lines.slice(1).map(line=>{
    const vals=splitCSVLine(line), row={};
    headers.forEach((h,i)=>row[h]=(vals[i]??'').trim());
    return row;
  }).filter(r=>r.teachername);
}
function normalizeSubject(s){ return s.replace(/輔導$/,'').replace(/加強$/,'').trim() || s; }
function sortChinese(a,b){ return String(a).localeCompare(String(b),'zh-Hant-TW'); }
function sortSubjects(a,b){
  const len=a.length-b.length;
  return len || sortChinese(a,b);
}

async function loadSemester(label) {
  $('loadingOverlay').classList.add('show');
  $('loginError').textContent='';
  try {
    const csvUrl=CONFIG.SEMESTERS[label];
    const csvRes=await fetch(csvUrl);
    if(!csvRes.ok) throw new Error(`CSV HTTP ${csvRes.status}`);
    scheduleData=parseCSV(await csvRes.text());
    const jsonUrl=csvUrl.replace(/timetable_[^/]+\.csv$/,'homerooms_1151.json');
    const hmRes=await fetch(jsonUrl);
    homeroomData=hmRes.ok ? await hmRes.json() : {};
    if(!scheduleData.length) throw new Error('CSV 沒有資料');
    buildIndexes();
    populateClassSelectors();
    populateSubjects();
    $('currentSemester').textContent=label;
    showView('queryView');
  } catch(err) {
    $('loginError').textContent=`載入失敗：${err.message}`;
  } finally { $('loadingOverlay').classList.remove('show'); }
}

function buildIndexes(){
  subjectTeachers={};
  scheduleData.forEach(row=>{
    for(let d=1;d<=5;d++) for(const p of PERIODS){
      const s=row[`s${d}${p}`]; if(!s) continue;
      const key=normalizeSubject(s);
      (subjectTeachers[key] ||= new Set()).add(row.teachername);
    }
  });
}
function allClasses(){
  const set=new Set();
  scheduleData.forEach(r=>{for(let d=1;d<=5;d++) for(const p of PERIODS){
    (r[`c${d}${p}`]||'').split(/\s+/).filter(Boolean).forEach(c=>set.add(c));
  }});
  return [...set].sort((a,b)=>Number(a)-Number(b));
}
function classGroups(){
  const groups={sel7:[],sel8:[],sel9:[],selSp:[]};
  allClasses().forEach(c=>/^7\d+$/.test(c)?groups.sel7.push(c):/^8\d+$/.test(c)?groups.sel8.push(c):/^9\d+$/.test(c)?groups.sel9.push(c):groups.selSp.push(c));
  return groups;
}
function populateClassSelectors(){
  const labels={sel7:'七年級',sel8:'八年級',sel9:'九年級',selSp:'特殊班'};
  const groups=classGroups();
  $('classGroups').innerHTML=Object.entries(groups).filter(([,list])=>list.length).map(([key,list])=>`
    <section class="class-grade-section">
      <div class="section-label grade-title">${labels[key]}</div>
      <div class="check-grid class-grid">${list.map(c=>`<label class="check-option class-option"><input type="checkbox" name="classChoice" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('')}</div>
    </section>`).join('');
  document.querySelectorAll('input[name="classChoice"]').forEach(cb=>cb.addEventListener('change',onClassChoiceChange));
  updateClassCount();
}
function onClassChoiceChange(e){
  const selected=[...document.querySelectorAll('input[name="classChoice"]:checked')];
  if(selected.length>MAX_CLASS_SELECTIONS){ e.target.checked=false; $('classError').textContent='最多可同時查詢 4 個班級。'; }
  else $('classError').textContent='';
  updateClassCount();
}
function getSelectedClasses(){ return [...document.querySelectorAll('input[name="classChoice"]:checked')].map(x=>x.value); }
function updateClassCount(){ $('classCount').textContent=`已選 ${getSelectedClasses().length} / ${MAX_CLASS_SELECTIONS}`; }

function populateSubjects(){
  const subjects=Object.keys(subjectTeachers).sort(sortSubjects);
  $('subjectGroups').innerHTML=subjects.map(s=>`<label class="check-option subject-option"><input type="checkbox" name="subjectChoice" value="${esc(s)}"><span>${esc(s)}</span></label>`).join('');
  document.querySelectorAll('input[name="subjectChoice"]').forEach(cb=>cb.addEventListener('change',updateTeacherGroups));
  updateTeacherGroups();
}
function getSelectedSubjects(){ return [...document.querySelectorAll('input[name="subjectChoice"]:checked')].map(x=>x.value); }
function teacherCheckboxId(subject,teacher){ return 'teacher-' + encodeURIComponent(subject+'||'+teacher).replace(/%/g,'_'); }
function getTeacherSelections(){
  const out={};
  document.querySelectorAll('input[name="teacherChoice"]:checked').forEach(cb=>{
    const [subject,teacher]=cb.value.split('||');
    (out[subject] ||= new Set()).add(teacher);
  });
  return out;
}
function updateTeacherGroups(){
  const subjects=getSelectedSubjects();
  $('subjectCount').textContent=`已選 ${subjects.length} 個科目`;
  const previous=getTeacherSelections();
  if(!subjects.length){
    $('teacherGroups').innerHTML='<div class="empty-selection">請先選擇科目</div>';
    $('teacherCount').textContent=`已指定 0 / ${MAX_TEACHER_SELECTIONS} 位教師`;
    return;
  }
  $('teacherGroups').innerHTML=subjects.map(subject=>{
    const teachers=[...(subjectTeachers[subject]||[])].sort(sortChinese);
    const selected=previous[subject] || new Set();
    return `<section class="teacher-subject-group">
      <div class="teacher-group-header"><span>${esc(subject)}</span><small>不選教師＝顯示本學科全部教師</small></div>
      <div class="check-grid teacher-grid">${teachers.map(t=>{
        const id=teacherCheckboxId(subject,t);
        return `<label class="check-option teacher-option"><input id="${id}" type="checkbox" name="teacherChoice" value="${esc(subject+'||'+t)}" ${selected.has(t)?'checked':''}><span>${esc(t)}</span></label>`;
      }).join('')}</div>
    </section>`;
  }).join('');
  document.querySelectorAll('input[name="teacherChoice"]').forEach(cb=>cb.addEventListener('change',onTeacherChoiceChange));
  updateTeacherCount();
}
function getUniqueSelectedTeacherNames(){
  return [...new Set([...document.querySelectorAll('input[name="teacherChoice"]:checked')].map(cb=>cb.value.split('||')[1]))];
}
function updateTeacherCount(){
  const n=getUniqueSelectedTeacherNames().length;
  $('teacherCount').textContent=`已指定 ${n} / ${MAX_TEACHER_SELECTIONS} 位教師`;
  $('teacherCount').classList.toggle('selection-limit-hit', n >= MAX_TEACHER_SELECTIONS);
}
function onTeacherChoiceChange(e){
  const n=getUniqueSelectedTeacherNames().length;
  if(n>MAX_TEACHER_SELECTIONS){
    e.target.checked=false;
    $('teacherError').textContent=`最多可同時指定 ${MAX_TEACHER_SELECTIONS} 位不同教師。`;
  } else {
    $('teacherError').textContent='';
  }
  updateTeacherCount();
}

function showView(id){
  ['loginView','queryView','resultView'].forEach(v=>$(v).style.display='none');
  $(id).style.display=id==='resultView'?'block':'flex';
}
function switchTab(tab){
  $('tabClass').classList.toggle('active',tab==='class');
  $('tabTeacher').classList.toggle('active',tab==='teacher');
  $('panelClass').classList.toggle('hidden',tab!=='class');
  $('panelTeacher').classList.toggle('hidden',tab!=='teacher');
}
function queryClass(){
  const classes=getSelectedClasses();
  if(!classes.length){ $('classError').textContent='請至少選擇一個班級。'; return; }
  if(classes.length>MAX_CLASS_SELECTIONS){ $('classError').textContent='最多可同時查詢 4 個班級。'; return; }
  $('classError').textContent='';
  navHistory=[]; displayClassSchedules(classes);
}
function queryTeacher(){
  const subjects=getSelectedSubjects();
  if(!subjects.length){ $('teacherError').textContent='請至少選擇一個科目。'; return; }
  const selected=getTeacherSelections();
  const teachers=[];
  subjects.forEach(subject=>{
    const chosen=selected[subject];
    if(chosen && chosen.size) chosen.forEach(t=>teachers.push(t));
    else (subjectTeachers[subject]||new Set()).forEach(t=>teachers.push(t));
  });
  const unique=[...new Set(teachers)].sort(sortChinese);
  if(!unique.length){ $('teacherError').textContent='找不到符合條件的教師。'; return; }
  if(unique.length>MAX_TEACHER_SELECTIONS){
    $('teacherError').textContent=`目前條件會包含 ${unique.length} 位教師，超過上限 ${MAX_TEACHER_SELECTIONS} 位。請縮小科目或指定教師。`;
    return;
  }
  $('teacherError').textContent='';
  navHistory=[]; displayTeacherSchedules(unique,subjects,selected);
}
function submitClassQuery(){ queryClass(); }
function submitTeacherQuery(){ queryTeacher(); }
function showQueryView(){ showView('queryView'); }

function cellsForClass(cls){
  const cells={};
  scheduleData.forEach(r=>{for(let d=1;d<=5;d++) for(const p of PERIODS){
    if((r[`c${d}${p}`]||'').split(/\s+/).includes(cls) && r[`s${d}${p}`]){
      const k=`${d}-${p}`; cells[k] ||= {subject:r[`s${d}${p}`],teachers:[]};
      if(!cells[k].teachers.includes(r.teachername)) cells[k].teachers.push(r.teachername);
    }
  }}); return cells;
}
function cellsForTeacher(t){
  const r=scheduleData.find(x=>x.teachername===t), cells={}; if(!r) return cells;
  for(let d=1;d<=5;d++) for(const p of PERIODS){
    if(r[`s${d}${p}`]) cells[`${d}-${p}`]={subject:r[`s${d}${p}`],classes:(r[`c${d}${p}`]||'').split(/\s+/).filter(Boolean)};
  } return cells;
}
function renderTable(cells,mode){
  let h='<table class="schedule-table"><thead><tr><th>節次</th>'+DAYS.map(d=>`<th>${d}</th>`).join('')+'</tr></thead><tbody>';
  const ps=Object.keys(cells).some(k=>k.endsWith('-0'))?[0,1,2,3,4,5,6,7,8]:[1,2,3,4,5,6,7,8];
  for(const p of ps){
    const tm=CONFIG.PERIOD_TIMES[p]||{};
    h+=`<tr><td class="td-period"><b>${p===0?'早自習':`第${p}節`}</b><small>${tm.start&&tm.start!=='——'?`${tm.start}<br>${tm.end}`:''}</small></td>`;
    for(let d=1;d<=5;d++){
      const c=cells[`${d}-${p}`];
      if(!c){h+='<td class="td-empty"></td>';continue;}
      const items=mode==='class'?c.teachers:c.classes;
      h+=`<td class="td-cell"><div class="cell-subject">${esc(c.subject)}</div><div class="cell-items">${items.map(x=>`<button class="cell-link" onclick="${mode==='class'?`displayTeacherSchedule('${esc(x)}')`:`displayClassSchedule('${esc(x)}')`}">${esc(x)}</button>`).join('')}</div></td>`;
    }
    h+='</tr>';
  }
  return h+'</tbody></table>';
}
function classScheduleBlock(cls){
  return `<section class="class-result-block"><h3 class="class-result-title">${esc(cls)} 班課表 ${homeroomData[cls]?`<span class="homeroom">（導師：${esc(homeroomData[cls])}）</span>`:''}</h3><div class="glass-card class-result-card" style="padding:0;overflow:hidden"><div class="table-wrapper">${renderTable(cellsForClass(cls),'class')}</div></div></section>`;
}
function displayClassSchedule(cls,pushHistory=true){
  if(pushHistory) navHistory.push({type:'class',value:cls});
  $('scheduleTitle').innerHTML=`${esc(cls)} 班課表 ${homeroomData[cls]?`<span class="homeroom">（導師：${esc(homeroomData[cls])}）</span>`:''}`;
  $('scheduleTableContainer').innerHTML=renderTable(cellsForClass(cls),'class'); showView('resultView');
}
function displayClassSchedules(classes,pushHistory=true){
  if(pushHistory) navHistory.push({type:'classes',value:[...classes]});
  $('scheduleTitle').textContent=`${classes.length} 個班級課表`;
  $('scheduleTableContainer').innerHTML=classes.map(classScheduleBlock).join('');
  showView('resultView');
}
function displayTeacherSchedule(t,pushHistory=true){
  if(pushHistory) navHistory.push({type:'teacher',value:t});
  $('scheduleTitle').textContent=`${t} 老師課表`;
  $('scheduleTableContainer').innerHTML=renderTable(cellsForTeacher(t),'teacher'); showView('resultView');
}
function combinedTeacherCells(teachers){
  const wanted=new Set(teachers), cells={};
  scheduleData.forEach(r=>{
    const teacher=r.teachername;
    if(!wanted.has(teacher)) return;
    for(let d=1;d<=5;d++) for(const p of PERIODS){
      const subject=r[`s${d}${p}`];
      if(!subject) continue;
      const classes=(r[`c${d}${p}`]||'').split(/\s+/).filter(Boolean);
      const k=`${d}-${p}`;
      (cells[k] ||= []).push({teacher,subject,classes});
    }
  });
  Object.values(cells).forEach(list=>{
    list.sort((a,b)=>sortChinese(a.teacher,b.teacher));
  });
  return cells;
}
function renderCombinedTeacherTable(cells){
  let h='<table class="schedule-table teacher-combined-table"><thead><tr><th>節次</th>'+DAYS.map(d=>`<th>星期${d}</th>`).join('')+'</tr></thead><tbody>';
  const ps=[1,2,3,4,5,6,7,8];
  for(const p of ps){
    const tm=CONFIG.PERIOD_TIMES[p]||{};
    h+=`<tr><td class="td-period"><b>第${p}節</b><small>${tm.start&&tm.start!=='——'?`${tm.start}<br>${tm.end}`:''}</small></td>`;
    for(let d=1;d<=5;d++){
      const entries=cells[`${d}-${p}`]||[];
      if(!entries.length){ h+='<td class="td-empty"></td>'; continue; }
      h+='<td class="td-cell teacher-combined-cell"><div class="teacher-entries">'+entries.map(e=>{
        const classes=e.classes.length?e.classes:[];
        const classHtml=classes.length
          ? classes.map(cls=>`<button class="cell-link teacher-class-link" onclick="displayClassSchedule('${esc(cls)}')">${esc(cls)}</button>`).join('')
          : '<span class="teacher-no-class">未標示班級</span>';
        return `<div class="teacher-entry"><button class="teacher-entry-name teacher-name-link" onclick="displayTeacherSchedule('${esc(e.teacher)}')">${esc(e.teacher)}</button><div class="teacher-entry-class">${classHtml}</div><div class="teacher-entry-subject">${esc(e.subject)}</div></div>`;
      }).join('')+'</div></td>';
    }
    h+='</tr>';
  }
  return h+'</tbody></table>';
}
function findCommonFreeSlots(teachers){
  const cells=combinedTeacherCells(teachers), slots=[];
  for(let d=1;d<=5;d++) for(const p of [1,2,3,4,5,6,7,8]){
    if(!(cells[`${d}-${p}`]||[]).length) slots.push({day:d,period:p});
  }
  return slots;
}
function renderCommonFreeSlots(teachers, visible=false){
  const slots=findCommonFreeSlots(teachers);
  if(!visible) return '';
  if(!slots.length) return `<section class="common-free-section"><h3>🟢 ${teachers.length} 位教師共同空堂</h3><div class="common-free-none">目前沒有找到所有選定教師同時無課的時段。</div></section>`;
  const byDay={};
  slots.forEach(x=>(byDay[x.day] ||= []).push(x.period));
  const items=Object.entries(byDay).map(([d,ps])=>`<div class="common-free-day"><b>星期${DAYS[Number(d)-1]}</b><span>${ps.map(p=>`第${p}節`).join('、')}</span></div>`).join('');
  return `<section class="common-free-section"><h3>🟢 ${teachers.length} 位教師共同空堂</h3><p>以下時段所有選定教師都沒有課，可作為會議或共同討論時間。</p><div class="common-free-list">${items}</div></section>`;
}
function toggleCommonFreeSlots(){
  const section=$('commonFreeSlots');
  const btn=$('commonFreeBtn');
  if(!section || !btn) return;
  const visible=section.classList.toggle('show-common-free');
  btn.textContent=visible?'↩ 隱藏共同空堂':'🟢 查看共同空堂';
  btn.setAttribute('aria-expanded',visible?'true':'false');
}
function displayTeacherSchedules(teachers,subjects,selected,pushHistory=true){
  if(pushHistory) navHistory.push({type:'teachers',value:[...teachers],subjects:[...subjects],selected:serializeTeacherSelections(selected)});
  const subjectText=subjects.map(s=>{
    const chosen=selected&&selected[s] instanceof Set?[...selected[s]]:(selected&&Array.isArray(selected[s])?selected[s]:[]);
    return chosen.length?`${s}－${chosen.join('、')}`:`${s}（全部教師）`;
  }).join('、');
  $('scheduleTitle').textContent=`教師綜合課表（${teachers.length} 位教師）`;
  const cells=combinedTeacherCells(teachers);
  const buttonHtml=teachers.length>1?`<button id="commonFreeBtn" class="btn btn-common-free" type="button" onclick="toggleCommonFreeSlots()" aria-expanded="false">🟢 查看共同空堂</button>`:'';
  $('scheduleTableContainer').innerHTML=`<div class="teacher-query-summary-row"><div class="teacher-query-summary">查詢條件：${esc(subjectText)}</div>${buttonHtml}</div><div class="glass-card teacher-result-card" style="padding:0;overflow:hidden"><div class="table-wrapper">${renderCombinedTeacherTable(cells)}</div></div><div id="commonFreeSlots" class="common-free-collapsible">${renderCommonFreeSlots(teachers,false)}</div>`;
  showView('resultView');
}
function serializeTeacherSelections(selected){
  const out={}; Object.entries(selected||{}).forEach(([s,set])=>out[s]=[...set]); return out;
}
function goBack(){
  if(navHistory.length<2){showView('queryView');return;}
  navHistory.pop(); const x=navHistory.pop();
  if(x.type==='classes') displayClassSchedules(x.value,false);
  else if(x.type==='class') displayClassSchedule(x.value,false);
  else if(x.type==='teachers') displayTeacherSchedules(x.value,x.subjects,x.selected,false);
  else displayTeacherSchedule(x.value,false);
}
function guestLogin(){ const label=$('semesterSelect').value; loadSemester(label); }
function logout(){ scheduleData=[];homeroomData={};navHistory=[];$('loginPassword').value='';showView('loginView'); }
function printSchedule(){ window.print(); }

// 讓結果頁面的教師按鈕仍可點回單一教師課表。
window.displayTeacherSchedule=displayTeacherSchedule;
window.displayClassSchedule=displayClassSchedule;


document.addEventListener('DOMContentLoaded',()=>{
  $('semesterSelect').innerHTML=Object.keys(CONFIG.SEMESTERS).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    if($('loginUsername').value===CONFIG.USERNAME && $('loginPassword').value===CONFIG.PASSWORD) loadSemester($('semesterSelect').value);
    else $('loginError').textContent='帳號或密碼錯誤；也可以直接使用「訪客登入」。';
  });
  showView('loginView');
});
