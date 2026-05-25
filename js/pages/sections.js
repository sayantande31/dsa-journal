/* ═══════════════════════════════════════════════════
   sections.js — v4.0 [2025-prompt-4]
   Contains: DayView, Revision (queue + tracker), Interviews, Resume
   Videos section removed → see resources.js
   Revision now has two sub-tabs:
     1. Queue — starred problems, mark-revised, overdue indicator
     2. Tracker — filter by days/date, red for 15+ days not revised
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};

/* ══════════════════════════════════════════
   DAY VIEW
══════════════════════════════════════════ */
window.Pages.DayView = (() => {
  function render() {
    buildMonthSelect();
    renderView();
    const searchEl = document.getElementById('dv-search');
    if (searchEl && !searchEl._wired) {
      searchEl.addEventListener('input', renderView);
      document.getElementById('dv-month')?.addEventListener('change', () => {
        const ed=document.getElementById('dv-exact-date'); if(ed) ed.value=''; renderView();
      });
      document.getElementById('dv-exact-date')?.addEventListener('change', () => {
        const m=document.getElementById('dv-month'); if(m) m.value=''; renderView();
      });
      document.getElementById('dv-clear-btn')?.addEventListener('click', () => {
        ['dv-search','dv-month','dv-exact-date'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
        renderView();
      });
      searchEl._wired = true;
    }
  }

  function buildMonthSelect() {
    const months = [...new Set(Store.get('problems').map(p=>(p.date||'').substring(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
    const sel = document.getElementById('dv-month'); if(!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">All months</option>` + months.map(m=>{
      const [yr,mo]=m.split('-');
      return `<option value="${m}" ${m===cur?'selected':''}>${new Date(yr,parseInt(mo)-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</option>`;
    }).join('');
  }

  function renderView() {
    const q         = (document.getElementById('dv-search')?.value||'').toLowerCase();
    const month     =  document.getElementById('dv-month')?.value||'';
    const exactDate =  document.getElementById('dv-exact-date')?.value||'';
    const today     = UI.today();
    const items = Store.get('problems').filter(p=>{
      const mQ = !q||p.title.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q));
      const mD = exactDate ? p.date===exactDate : !month||(p.date||'').startsWith(month);
      return mQ&&mD;
    });
    const groups={};
    items.forEach(p=>{ const d=p.date||'unknown'; if(!groups[d]) groups[d]=[]; groups[d].push(p); });
    const sorted=Object.keys(groups).sort((a,b)=>b.localeCompare(a));
    const el=document.getElementById('dv-list'); if(!el) return;
    if(!sorted.length){el.innerHTML=UI.emptyState('calendar','No problems found for this period');return;}
    el.innerHTML=sorted.map(date=>{
      const probs=groups[date];
      return `<div class="day-group">
        <div class="day-group-header">
          <span class="day-group-date">${date==='unknown'?'No date':UI.fmtDateLong(date)}</span>
          <span class="day-count-badge">${probs.length} problem${probs.length!==1?'s':''}</span>
          ${date===today?'<span class="today-badge">Today</span>':''}
        </div>
        <div class="entries-list">${probs.map(e=>UI.entryCardHTML(e,dvActions(e))).join('')}</div>
      </div>`;
    }).join('');
    wireView(el);
  }

  function dvActions(e) {
    return `${e.link?`<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>`:''}
      <button class="iBtn ${e.flagged?'star-on':''}" data-dv-flag="${e.id}"><i class="ti ti-star"></i></button>`;
  }

  function wireView(el) {
    el.querySelectorAll('[data-toggle]').forEach(btn=>{
      btn.addEventListener('click',()=>{UI.toggleCard(btn.dataset.toggle);renderView();});
    });
    el.querySelectorAll('.ebtab').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.setCardBodyTab(btn.dataset.card,btn.dataset.tab);renderView();});
    });
    el.querySelectorAll('[data-dv-flag]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();
        const p=Store.get('problems').find(x=>x.id===btn.dataset.dvFlag);
        if(p){Store.update('problems',p.id,{flagged:!p.flagged});renderView();Router.refreshBadges();}
      });
    });
    el.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});
    });
  }
  return {render};
})();

/* ══════════════════════════════════════════
   REVISION  — Queue + Tracker sub-tabs
══════════════════════════════════════════ */
window.Pages.Revision = (() => {
  let activeTab = 'queue';
  let trackerFilter = '7';

  function render() {
    renderTabBar();
    if (activeTab==='queue') renderQueue();
    else renderTracker();
  }

  function renderTabBar() {
    const bar = document.getElementById('rev-tab-bar'); if(!bar) return;
    bar.innerHTML = `
      <button class="rev-tab ${activeTab==='queue'?'active':''}" data-rtab="queue"><i class="ti ti-star"></i> Revision Queue</button>
      <button class="rev-tab ${activeTab==='tracker'?'active':''}" data-rtab="tracker"><i class="ti ti-history"></i> Revision Tracker</button>`;
    bar.querySelectorAll('[data-rtab]').forEach(btn=>{
      btn.addEventListener('click',()=>{activeTab=btn.dataset.rtab;render();});
    });
  }

  /* ── Queue ── */
  function renderQueue() {
    const qPane=document.getElementById('rev-queue-pane');
    const tPane=document.getElementById('rev-tracker-pane');
    if(qPane) qPane.style.display='block';
    if(tPane) tPane.style.display='none';
    const flagged=Store.get('problems').filter(p=>p.flagged);
    const el=document.getElementById('rev-list'); if(!el) return;
    if(!flagged.length){el.innerHTML=UI.emptyState('star','No problems starred. Click ★ on any problem to add it here.');return;}
    el.innerHTML=`<div class="entries-list">${flagged.map(e=>UI.entryCardHTML(e,qActions(e))).join('')}</div>`;
    wireQueue(el);
  }

  function daysSince(iso) {
    if(!iso) return null;
    return Math.floor((new Date()-new Date(iso))/(1000*60*60*24));
  }

  function qActions(e) {
    const log=Store.getRevisionLog(e.id);
    const days=log?daysSince(log.lastRevised):null;
    const overdue=days!==null&&days>15;
    return `
      ${e.link?`<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>`:''}
      <button class="iBtn" data-mark-revised="${e.id}" title="Mark revised today" style="color:${overdue?'var(--red)':'var(--txt3)'}"><i class="ti ti-refresh"></i>${overdue?`<span style="font-size:8px;display:block;color:var(--red);text-align:center;line-height:1">${days}d</span>`:''}</button>
      <button class="iBtn star-on" data-rev-unflag="${e.id}"><i class="ti ti-star"></i></button>`;
  }

  function wireQueue(el) {
    el.querySelectorAll('[data-toggle]').forEach(btn=>{btn.addEventListener('click',()=>{UI.toggleCard(btn.dataset.toggle);renderQueue();});});
    el.querySelectorAll('.ebtab').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();UI.setCardBodyTab(btn.dataset.card,btn.dataset.tab);renderQueue();});});
    el.querySelectorAll('[data-rev-unflag]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();Store.update('problems',btn.dataset.revUnflag,{flagged:false});renderQueue();Router.refreshBadges();});});
    el.querySelectorAll('[data-mark-revised]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();Store.logRevision(btn.dataset.markRevised);UI.toast('Revision logged ✓','ok');renderQueue();});});
    el.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});});
  }

  /* ── Tracker ── */
  function renderTracker() {
    const qPane=document.getElementById('rev-queue-pane');
    const tPane=document.getElementById('rev-tracker-pane');
    if(qPane) qPane.style.display='none';
    if(tPane) tPane.style.display='block';
    buildTrackerFilters();
    renderTrackerList();
  }

  function buildTrackerFilters() {
    const bar=document.getElementById('rev-tracker-filter-bar'); if(!bar||bar._built) return;
    bar.innerHTML=`
      <button class="chip ${trackerFilter==='7'?'active':''}" data-tf="7">Last 7 days</button>
      <button class="chip ${trackerFilter==='30'?'active':''}" data-tf="30">Last 30 days</button>
      <button class="chip ${trackerFilter==='all'?'active':''}" data-tf="all">All time</button>
      <span style="font-size:11px;font-family:var(--font-mono);color:var(--txt3)">or pick date:</span>
      <input type="date" id="rev-tracker-date" style="width:130px;padding:5px 8px;font-size:11px;font-family:var(--font-mono);background:var(--bg3);border:1px solid var(--line2);border-radius:var(--r);color:var(--txt)"/>`;
    bar.querySelectorAll('[data-tf]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        trackerFilter=btn.dataset.tf;
        const d=document.getElementById('rev-tracker-date');if(d)d.value='';
        bar.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
        btn.classList.add('active');
        renderTrackerList();
      });
    });
    document.getElementById('rev-tracker-date')?.addEventListener('change',e=>{
      if(e.target.value){trackerFilter=e.target.value;bar.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));renderTrackerList();}
    });
    bar._built=true;
  }

  function getCutoffDate() {
    if(trackerFilter==='all') return null;
    if(trackerFilter.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(trackerFilter+'T00:00:00');
    const d=new Date(); d.setDate(d.getDate()-parseInt(trackerFilter||'7')); d.setHours(0,0,0,0); return d;
  }

  function renderTrackerList() {
    const el=document.getElementById('rev-tracker-list'); if(!el) return;
    const problems=Store.get('problems');
    const revLog=Store.getRaw('revisionLog')||{};
    const cutoff=getCutoffDate();
    const relevant=problems.filter(p=>!cutoff||(p.date&&new Date(p.date+'T00:00:00')>=cutoff));
    if(!relevant.length){el.innerHTML=UI.emptyState('history','No problems studied in this period');return;}
    el.innerHTML=`
      <div style="font-size:11px;font-family:var(--font-mono);color:var(--txt3);margin-bottom:10px">${relevant.length} problem${relevant.length!==1?'s':''} — <span style="color:var(--red)">red</span> = not revised in 15+ days</div>
      <div class="entries-list">
        ${relevant.map(p=>{
          const log=revLog[p.id];
          const days=log?daysSince(log.lastRevised):null;
          const overdue=days!==null&&days>15;
          const never=days===null;
          const color=overdue?'var(--red)':never?'var(--txt3)':'var(--green)';
          return `<div class="entry-card" style="${overdue?'border-left:3px solid var(--red)':''}">
            <div style="padding:.75rem 1rem;display:flex;align-items:flex-start;gap:10px">
              <div style="flex:1;min-width:0">
                <div style="font-family:var(--font-head);font-size:14px;font-weight:600;color:var(--txt)">${UI.esc(p.title)}</div>
                <div class="entry-meta-row" style="flex-wrap:wrap;margin-top:4px">
                  ${p.difficulty?UI.diffBadge(p.difficulty):''}
                  <span><i class="ti ti-calendar"></i> ${UI.fmtDate(p.date)}</span>
                  <span style="color:${color}">${log?`<i class="ti ti-refresh"></i> ${UI.fmtDate(log.lastRevised.split('T')[0])} (${days}d ago)':'<i class="ti ti-alert-triangle"></i> Never revised'}</span>
                  ${overdue?`<span style="background:var(--red-d);color:var(--red);font-size:10px;padding:2px 7px;border-radius:99px;font-family:var(--font-mono)">⚠ Overdue</span>`:''}
                </div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                ${p.link?`<a href="${UI.esc(p.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>`:''}
                <button class="iBtn" data-tracker-revise="${p.id}" style="color:${overdue?'var(--red)':'var(--txt3)'}"><i class="ti ti-refresh"></i></button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    el.querySelectorAll('[data-tracker-revise]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();Store.logRevision(btn.dataset.trackerRevise);UI.toast('Revision logged ✓','ok');renderTrackerList();});
    });
  }

  return {render};
})();

/* ══════════════════════════════════════════
   INTERVIEWS
══════════════════════════════════════════ */
window.Pages.Interviews = (() => {
  let editingId=null;
  const openSet=new Set();

  function render() {
    renderList();
    const saveBtn=document.getElementById('int-save-btn');
    if(saveBtn&&!saveBtn._wired){
      saveBtn.addEventListener('click',save);
      saveBtn._wired=true;
    }
    const clearBtn=document.getElementById('int-clear-btn');
    if(clearBtn&&!clearBtn._wired){
      clearBtn.addEventListener('click',clearForm);
      clearBtn._wired=true;
    }
    const searchEl=document.getElementById('int-search');
    if(searchEl&&!searchEl._wired){
      searchEl.addEventListener('input',renderList);
      searchEl._wired=true;
    }
  }

  function clearForm(){
    editingId=null;
    ['int-company','int-role','int-round','int-date','int-questions','int-experience','int-outcome'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const st=document.getElementById('int-status');if(st)st.value='Attended';
    const sb=document.getElementById('int-save-btn');if(sb)sb.textContent='💾 Save Experience';
  }

  function save(){
    const company=document.getElementById('int-company')?.value.trim()||'';
    if(!company){UI.toast('Company required','err');return;}
    Store.upsert('interviews',{
      id:editingId||UI.uid(),company,
      role:document.getElementById('int-role')?.value.trim()||'',
      round:document.getElementById('int-round')?.value.trim()||'',
      date:document.getElementById('int-date')?.value||UI.today(),
      status:document.getElementById('int-status')?.value||'Attended',
      questions:document.getElementById('int-questions')?.value.trim()||'',
      experience:document.getElementById('int-experience')?.value.trim()||'',
      outcome:document.getElementById('int-outcome')?.value.trim()||'',
    });
    clearForm();renderList();Router.refreshBadges();
    UI.toast('Interview saved ✓','ok');
  }

  function deleteInt(id){
    if(!UI.confirm('Delete?'))return;
    Store.remove('interviews',id);renderList();Router.refreshBadges();
  }

  function editInt(id){
    const e=Store.get('interviews').find(x=>x.id===id);if(!e)return;
    editingId=id;
    const set=(elId,val)=>{const el=document.getElementById(elId);if(el)el.value=val;};
    set('int-company',e.company||'');set('int-role',e.role||'');set('int-round',e.round||'');
    set('int-date',e.date||'');set('int-status',e.status||'Attended');
    set('int-questions',e.questions||'');set('int-experience',e.experience||'');set('int-outcome',e.outcome||'');
    const sb=document.getElementById('int-save-btn');if(sb)sb.textContent='✏️ Update';
    document.getElementById('int-form-anchor')?.scrollIntoView({behavior:'smooth'});
  }

  function renderList(){
    const q=(document.getElementById('int-search')?.value||'').toLowerCase();
    const list=Store.get('interviews').filter(e=>!q||e.company.toLowerCase().includes(q)||(e.role||'').toLowerCase().includes(q)||(e.round||'').toLowerCase().includes(q));
    const el=document.getElementById('int-list');if(!el)return;
    if(!list.length){el.innerHTML=UI.emptyState('building','No interview experiences logged yet.');return;}
    const sc=s=>s==='Selected'?'var(--green)':s==='Rejected'?'var(--red)':'var(--amber)';
    el.innerHTML=list.map(e=>`
      <div class="interview-card ${openSet.has(e.id)?'open':''}" id="ic-${e.id}">
        <div class="interview-card-header" data-int-toggle="${e.id}">
          <i class="ti ti-chevron-right entry-chevron"></i>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="interview-company">${UI.esc(e.company)}</span>
              ${e.role?`<span class="badge badge-status">${UI.esc(e.role)}</span>`:''}
              ${e.round?`<span class="badge badge-theory">${UI.esc(e.round)}</span>`:''}
              <span style="font-size:10px;font-family:var(--font-mono);padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.2);color:${sc(e.status||'Attended')}">${e.status||'Attended'}</span>
            </div>
            <div class="interview-round">${e.date?UI.fmtDate(e.date):''}</div>
          </div>
          <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
            <button class="iBtn" data-int-edit="${e.id}"><i class="ti ti-edit"></i></button>
            <button class="iBtn del" data-int-del="${e.id}"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        ${openSet.has(e.id)?`<div class="interview-body">
          ${e.questions?`<div class="section-label" style="margin-bottom:6px">Questions Asked</div><div class="notes-block" style="margin-bottom:1rem">${UI.esc(e.questions)}</div>`:''}
          ${e.experience?`<div class="section-label" style="margin-bottom:6px">Experience</div><div class="notes-block" style="margin-bottom:1rem">${UI.esc(e.experience)}</div>`:''}
          ${e.outcome?`<div class="section-label" style="margin-bottom:6px">Outcome / Learnings</div><div class="notes-block">${UI.esc(e.outcome)}</div>`:''}
        </div>`:''}
      </div>`).join('');
    el.querySelectorAll('[data-int-toggle]').forEach(btn=>{btn.addEventListener('click',()=>{const id=btn.dataset.intToggle;if(openSet.has(id))openSet.delete(id);else openSet.add(id);renderList();});});
    el.querySelectorAll('[data-int-edit]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();editInt(btn.dataset.intEdit);});});
    el.querySelectorAll('[data-int-del]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();deleteInt(btn.dataset.intDel);});});
  }
  return{render};
})();

/* ══════════════════════════════════════════
   RESUME
══════════════════════════════════════════ */
window.Pages.Resume = (() => {
  let pendingFile=null, pendingDataURL=null;

  function render(){
    renderGrid();
    const saveBtn=document.getElementById('res-save-btn');
    if(saveBtn&&!saveBtn._wired){saveBtn.addEventListener('click',save);saveBtn._wired=true;}
    const fileEl=document.getElementById('res-file');
    if(fileEl&&!fileEl._wired){fileEl.addEventListener('change',onFileChange);fileEl._wired=true;}
  }

  function onFileChange(e){
    const file=e.target.files[0];if(!file)return;
    if(file.type!=='application/pdf'){UI.toast('Only PDF supported','err');return;}
    if(file.size>5*1024*1024){UI.toast('Max 5MB','err');return;}
    pendingFile=file;
    const lbl=document.getElementById('res-file-label');if(lbl)lbl.textContent=file.name;
    const reader=new FileReader();
    reader.onload=ev=>{pendingDataURL=ev.target.result;};
    reader.readAsDataURL(file);
  }

  function viewDoc(dataURL, label) {
    const overlay = document.getElementById('doc-viewer-overlay');
    const frame   = document.getElementById('doc-viewer-frame');
    const title   = document.getElementById('doc-viewer-title');
    if (!overlay||!frame) return;
    if (title) title.textContent = label;
    frame.src = dataURL;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function save(){
    const label=document.getElementById('res-label')?.value.trim()||'';
    if(!label){UI.toast('Enter a label','err');return;}
    if(!pendingDataURL){UI.toast('Select a PDF','err');return;}
    Store.add('resumes',{id:UI.uid(),label,note:document.getElementById('res-note')?.value.trim()||'',fileName:pendingFile.name,dataURL:pendingDataURL,addedAt:new Date().toISOString()});
    const labelInp=document.getElementById('res-label');if(labelInp)labelInp.value='';
    const noteInp=document.getElementById('res-note');if(noteInp)noteInp.value='';
    const fileInp=document.getElementById('res-file');if(fileInp)fileInp.value='';
    const fileLabel=document.getElementById('res-file-label');if(fileLabel)fileLabel.textContent='Click to select PDF…';
    pendingFile=null;pendingDataURL=null;
    renderGrid();Router.refreshBadges();
    UI.toast('Resume saved ✓','ok');
  }

  function download(id){const r=Store.get('resumes').find(x=>x.id===id);if(!r)return;const a=document.createElement('a');a.href=r.dataURL;a.download=r.fileName||'resume.pdf';a.click();}
  function deleteResume(id){if(!UI.confirm('Delete?'))return;Store.remove('resumes',id);renderGrid();UI.toast('Deleted','warn');}

  function renderGrid(){
    const resumes=Store.get('resumes');
    const el=document.getElementById('res-grid');if(!el)return;
    if(!resumes.length){el.innerHTML=UI.emptyState('file-description','No resumes uploaded yet.');return;}
    el.innerHTML=`<div class="resume-grid">${resumes.map(r=>`
      <div class="resume-card">
        <div>
          <div class="resume-card-title">${UI.esc(r.label)}</div>
          <div class="resume-card-meta">${r.fileName||''} · ${new Date(r.addedAt).toLocaleDateString('en-GB')}</div>
          ${r.note?`<div style="font-size:12px;color:var(--txt3);margin-top:4px;font-family:var(--font-mono)">${UI.esc(r.note)}</div>`:''}
        </div>
        <div class="resume-actions">
          <button class="btn btn-sm" data-view="${r.id}" title="View PDF"><i class="ti ti-eye"></i> View</button>
          <button class="btn btn-primary btn-sm" data-dl="${r.id}"><i class="ti ti-download"></i> Download</button>
          <button class="btn btn-danger btn-sm" data-del-res="${r.id}"><i class="ti ti-trash"></i></button>
        </div>
      </div>`).join('')}</div>`;
    el.querySelectorAll('[data-view]').forEach(btn=>{btn.addEventListener('click',()=>{const r=Store.get('resumes').find(x=>x.id===btn.dataset.view);if(r)viewDoc(r.dataURL,r.label);});});
    el.querySelectorAll('[data-dl]').forEach(btn=>{btn.addEventListener('click',()=>download(btn.dataset.dl));});
    el.querySelectorAll('[data-del-res]').forEach(btn=>{btn.addEventListener('click',()=>deleteResume(btn.dataset.delRes));});
  }
  return{render};
})();
