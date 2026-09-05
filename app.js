/* 桃園市立經國國民中學｜課表查詢前端 */
let scheduleData = [];
let homeroomData = {};
let subjectTeachers = {};
let navHistory = [];
const DAYS = ['一','二','三','四','五'];
const PERIODS = [0,1,2,3,4,5,6,7,8];

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

async function loadSemester(label) {
  $('loadingOverlay').classList.add('show');
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
function populateClassSelectors(){
  const groups={sel7:[],sel8:[],sel9:[],selSp:[]};
  allClasses().forEach(c=>/^7\d+$/.test(c)?groups.sel7.push(c):/^8\d+$/.test(c)?groups.sel8.push(c):/^9\d+$/.test(c)?groups.sel9.push(c):groups.selSp.push(c));
  for(const [id,list] of Object.entries(groups)) $(id).innerHTML='<option value="">— 選擇班級 —</option>'+list.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function populateSubjects(){
  $('subjectSelect').innerHTML='<option value="">— 選擇科目 —</option>'+Object.keys(subjectTeachers).sort().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('teacherSelect').innerHTML='<option value="">— 請先選擇科目 —</option>';
}
function populateTeachers(){
  const s=$('subjectSelect').value;
  $('teacherSelect').innerHTML='<option value="">— 選擇教師 —</option>'+[...(subjectTeachers[s]||[])].sort().map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
}
function showView(id){
  ['loginView','queryView','resultView'].forEach(v=>$(v).style.display='none');
  $(id).style.display=id==='resultView'?'block':'flex';
}
function switchTab(tab){
  $('tabClass').classList.toggle('active',tab==='class'); $('tabTeacher').classList.toggle('active',tab==='teacher');
  $('panelClass').classList.toggle('hidden',tab!=='class'); $('panelTeacher').classList.toggle('hidden',tab!=='teacher');
}
function resetSelectors(){ ['sel7','sel8','sel9','selSp'].forEach(id=>$(id).value=''); $('classError').textContent=''; $('teacherError').textContent=''; }
function queryClass(){
  const cls=['sel7','sel8','sel9','selSp'].map(id=>$(id).value).find(Boolean);
  if(!cls){ $('classError').textContent='請先選擇一個班級'; return; }
  navHistory=[]; displayClassSchedule(cls);
}
function queryTeacher(){
  const t=$('teacherSelect').value;
  if(!t){ $('teacherError').textContent='請先選擇科目與教師'; return; }
  navHistory=[]; displayTeacherSchedule(t);
}

// HTML 按鈕使用的事件名稱（保留原本查詢函式）
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
  for(const p of ps){ const tm=CONFIG.PERIOD_TIMES[p]||{}; h+=`<tr><td class="td-period"><b>${p===0?'早自習':`第${p}節`}</b><small>${tm.start&&tm.start!=='——'?`${tm.start}<br>${tm.end}`:''}</small></td>`;
    for(let d=1;d<=5;d++){ const c=cells[`${d}-${p}`]; if(!c){h+='<td class="td-empty"></td>';continue;}
      const items=mode==='class'?c.teachers:c.classes;
      h+=`<td class="td-cell"><div class="cell-subject">${esc(c.subject)}</div><div class="cell-items">${items.map(x=>`<button class="cell-link" onclick="${mode==='class'?`displayTeacherSchedule('${esc(x)}')`:`displayClassSchedule('${esc(x)}')`}">${esc(x)}</button>`).join('')}</div></td>`;
    } h+='</tr>';
  } return h+'</tbody></table>';
}
function displayClassSchedule(cls){
  navHistory.push({type:'class',value:cls});
  $('scheduleTitle').innerHTML=`${esc(cls)} 班課表 ${homeroomData[cls]?`<span class="homeroom">（導師：${esc(homeroomData[cls])}）</span>`:''}`;
  $('scheduleTableContainer').innerHTML=renderTable(cellsForClass(cls),'class'); showView('resultView');
}
function displayTeacherSchedule(t){
  navHistory.push({type:'teacher',value:t}); $('scheduleTitle').textContent=`${t} 老師課表`;
  $('scheduleTableContainer').innerHTML=renderTable(cellsForTeacher(t),'teacher'); showView('resultView');
}
function goBack(){
  if(navHistory.length<2){showView('queryView');return;} navHistory.pop(); const x=navHistory.pop(); x.type==='class'?displayClassSchedule(x.value):displayTeacherSchedule(x.value);
}
function guestLogin(){ const label=$('semesterSelect').value; loadSemester(label); }
function logout(){ scheduleData=[];homeroomData={};navHistory=[];$('loginPassword').value='';showView('loginView'); }
function printSchedule(){ window.print(); }

document.addEventListener('DOMContentLoaded',()=>{
  $('semesterSelect').innerHTML=Object.keys(CONFIG.SEMESTERS).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('loginForm').addEventListener('submit',e=>{e.preventDefault(); if($('loginUsername').value===CONFIG.USERNAME && $('loginPassword').value===CONFIG.PASSWORD) loadSemester($('semesterSelect').value); else $('loginError').textContent='帳號或密碼錯誤；也可以直接使用「訪客登入」。';});
  $('subjectSelect').addEventListener('change',populateTeachers);
  showView('loginView');
});
