/* ═══════════════════════════════════
   sections.js v2
   DayView: date range filter added
   Videos: YouTube embed preview added
   Java: unchanged but wiring guard fixed
   Interviews: unchanged
   Resume: unchanged
═══════════════════════════════════ */
window.Pages = window.Pages || {};

/* ══════════════════════════════════════════
   DAY VIEW
══════════════════════════════════════════ */
window.Pages.DayView = (() => {
  let wired = false;
  function render() {
    buildMonthSelect();
    renderView();
    if (!wired) {
      document.getElementById('dv-search').addEventListener('input', renderView);
      document.getElementById('dv-month').addEventListener('change', ()=>{ clearExactDate(); renderView(); });
      document.getElementById('dv-exact-date').addEventListener('change', ()=>{ document.getElementById('dv-month').value=''; renderView(); });
      document.getElementById('dv-clear-btn').addEventListener('click', ()=>{
        document.getElementById('dv-search').value='';
        document.getElementById('dv-month').value='';
        document.getElementById('dv-exact-date').value='';
        renderView();
      });
      wired=true;
    }
  }

  function clearExactDate() { document.getElementById('dv-exact-date').value=''; }

  function buildMonthSelect() {
    const months=[...new Set(Store.get('problems').map(p=>(p.date||'').substring(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
    const sel=document.getElementById('dv-month');
    const cur=sel.value;
    sel.innerHTML=`<option value="">All months</option>`+months.map(m=>{
      const [yr,mo]=m.split('-');
      return `<option value="${m}" ${m===cur?'selected':''}>${new Date(yr,parseInt(mo)-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</option>`;
    }).join('');
  }

  function renderView() {
    const q         = (document.getElementById('dv-search').value||'').toLowerCase();
    const month     = document.getElementById('dv-month').value;
    const exactDate = document.getElementById('dv-exact-date').value;
    const today     = UI.today();

    const items = Store.get('problems').filter(p=>{
      const mQ = !q||p.title.toLowerCase().includes(q)||(p.tags||[]).some(t=>t.toLowerCase().includes(q));
      const mD = exactDate ? p.date===exactDate : !month||(p.date||'').startsWith(month);
      return mQ && mD;
    });

    const groups={};
    items.forEach(p=>{ const d=p.date||'unknown'; if(!groups[d]) groups[d]=[]; groups[d].push(p); });
    const sorted=Object.keys(groups).sort((a,b)=>b.localeCompare(a));

    const el=document.getElementById('dv-list');
    if (!sorted.length) { el.innerHTML=UI.emptyState('calendar','No problems found for this period'); return; }
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
    wire(el);
  }

  function dvActions(e) {
    return `${e.link?`<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>`:''}
      <button class="iBtn ${e.flagged?'star-on':''}" data-dv-flag="${e.id}"><i class="ti ti-star"></i></button>`;
  }

  function wire(el) {
    el.querySelectorAll('[data-toggle]').forEach(btn=>{
      btn.addEventListener('click',()=>{ UI.toggleCard(btn.dataset.toggle); renderView(); });
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
   REVISION
══════════════════════════════════════════ */
window.Pages.Revision = (() => {
  function render() {
    const flagged=Store.get('problems').filter(p=>p.flagged);
    const el=document.getElementById('rev-list');
    if (!flagged.length) { el.innerHTML=UI.emptyState('star','No problems starred yet. Click ★ on any problem to add it here.'); return; }
    el.innerHTML=`<div class="entries-list">${flagged.map(e=>UI.entryCardHTML(e,revActions(e))).join('')}</div>`;
    wire(el);
  }
  function revActions(e){
    return `${e.link?`<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>`:''}
      <button class="iBtn star-on" data-rev-unflag="${e.id}"><i class="ti ti-star"></i></button>`;
  }
  function wire(el){
    el.querySelectorAll('[data-toggle]').forEach(btn=>{
      btn.addEventListener('click',()=>{UI.toggleCard(btn.dataset.toggle);render();});
    });
    el.querySelectorAll('.ebtab').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.setCardBodyTab(btn.dataset.card,btn.dataset.tab);render();});
    });
    el.querySelectorAll('[data-rev-unflag]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();Store.update('problems',btn.dataset.revUnflag,{flagged:false});render();Router.refreshBadges();});
    });
    el.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});
    });
  }
  return {render};
})();

/* ══════════════════════════════════════════
   VIDEOS / RESOURCES
   Supports multiple YouTube links per entry
══════════════════════════════════════════ */
window.Pages.Videos = (() => {
  let wired=false;
  function render(){
    renderGrid();
    if(!wired){
      document.getElementById('vid-save-btn').addEventListener('click',saveVideo);
      wired=true;
    }
  }

  function ytThumb(url){
    try {
      const u=new URL(url);
      let vid='';
      if(u.hostname.includes('youtube.com')) vid=u.searchParams.get('v');
      else if(u.hostname.includes('youtu.be')) vid=u.pathname.slice(1);
      return vid?`https://img.youtube.com/vi/${vid}/mqdefault.jpg`:'';
    } catch{return '';}
  }

  function saveVideo(){
    const title=document.getElementById('vid-title').value.trim();
    const mainUrl=document.getElementById('vid-url').value.trim();
    if(!title||!mainUrl){UI.toast('Title and URL required','err');return;}
    // extra YT links
    const extraRaw=(document.getElementById('vid-extra-links').value||'').trim();
    const extraLinks=extraRaw?extraRaw.split('\n').map(l=>l.trim()).filter(Boolean):[];
    Store.add('videos',{
      id:UI.uid(),title,url:mainUrl,extraLinks,
      topic:document.getElementById('vid-topic').value.trim(),
      status:document.getElementById('vid-status').value,
      addedAt:new Date().toISOString(),
    });
    ['vid-title','vid-url','vid-topic','vid-extra-links'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
    document.getElementById('vid-status').value='To watch';
    renderGrid();Router.refreshBadges();UI.toast('Resource saved ✓','ok');
  }

  function deleteVideo(id){
    if(!UI.confirm('Remove?'))return;
    Store.remove('videos',id);renderGrid();Router.refreshBadges();
  }

  function renderGrid(){
    const vids=Store.get('videos');
    const el=document.getElementById('vid-grid');
    if(!vids.length){el.innerHTML=UI.emptyState('player-play','No resources saved yet.');return;}
    el.innerHTML=`<div class="video-grid">${vids.map(v=>{
      const thumb=ytThumb(v.url);
      const allLinks=[v.url,...(v.extraLinks||[])];
      return `<div class="vid-card">
        <div class="vid-thumb" onclick="window.open('${UI.esc(v.url)}','_blank','noopener')" style="cursor:pointer">
          ${thumb?`<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`:''}
          <i class="ti ti-brand-youtube" style="${thumb?'display:none':''}"></i>
          <div class="vid-overlay"><i class="ti ti-player-play"></i></div>
        </div>
        <div class="vid-info">
          <div class="vid-title">${UI.esc(v.title)}</div>
          <div class="vid-meta">${v.topic?UI.esc(v.topic)+' · ':''}<span class="${v.status==='Watched'?'vid-watched':''}">${v.status}</span></div>
          ${allLinks.length>1?`<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">
            ${allLinks.map((l,i)=>`<a href="${UI.esc(l)}" target="_blank" rel="noopener" style="font-size:10px;font-family:var(--font-mono);color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              <i class="ti ti-link" style="font-size:10px"></i> Link ${i+1}
            </a>`).join('')}
          </div>`:''}
        </div>
        <button class="iBtn del vid-del" data-del-vid="${v.id}" title="Remove"><i class="ti ti-trash"></i></button>
      </div>`;
    }).join('')}</div>`;

    el.querySelectorAll('[data-del-vid]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();deleteVideo(btn.dataset.delVid);});
    });
  }
  return{render};
})();

/* ══════════════════════════════════════════
   JAVA Q&A
══════════════════════════════════════════ */
window.Pages.Java = (() => {
  let tagMgr,codeEditor,filterCat='All',editingId=null,wired=false;
  const JAVA_CATS=['Core Java','Collections','Multithreading','JVM','Spring','Hibernate','Java 8+','Design Patterns','OOPS','Streams','Generics','Other'];

  function render(){
    renderCatFilter();
    renderList();
    if(!wired){
      initForm();
      document.getElementById('java-search').addEventListener('input',renderList);
      wired=true;
    }
  }

  function renderCatFilter(){
    const el=document.getElementById('java-cat-filter');
    if(el._built)return;
    el.innerHTML=['All',...JAVA_CATS].map(c=>`<button class="java-cat-chip ${c===filterCat?'active':''}" data-jcat="${UI.esc(c)}">${UI.esc(c)}</button>`).join('');
    el.addEventListener('click',e=>{
      const chip=e.target.closest('[data-jcat]');if(!chip)return;
      filterCat=chip.dataset.jcat;
      el.querySelectorAll('.java-cat-chip').forEach(c=>c.classList.remove('active'));chip.classList.add('active');renderList();
    });
    el._built=true;
  }

  function initForm(){
    tagMgr=UI.TagManager(document.getElementById('java-tags'),document.getElementById('java-tag-presets'));
    const cedWrap=document.getElementById('java-code-editor');
    cedWrap.id='ced-java';
    codeEditor=UI.CodeEditor(cedWrap,[{id:'answer',label:'Code / Answer',code:'',complexity:''}]);
    document.getElementById('java-save-btn').addEventListener('click',saveJava);
    document.getElementById('java-clear-btn').addEventListener('click',clearForm);
  }

  function clearForm(){
    editingId=null;
    ['java-q','java-notes'].forEach(id=>{ const e=document.getElementById(id);if(e) e.value=''; });
    document.getElementById('java-cat').value='Core Java';
    document.getElementById('java-diff').value='Medium';
    tagMgr&&tagMgr.reset();
    codeEditor&&codeEditor.setTabs([{id:'answer',label:'Code / Answer',code:'',complexity:''}]);
    document.getElementById('java-save-btn').textContent='💾 Save Question';
  }

  function saveJava(){
    const q=document.getElementById('java-q').value.trim();if(!q){UI.toast('Enter the question','err');return;}
    const item={id:editingId||UI.uid(),title:q,category:document.getElementById('java-cat').value,difficulty:document.getElementById('java-diff').value,notes:document.getElementById('java-notes').value.trim(),codeTabs:codeEditor.getTabs(),tags:tagMgr.getTags(),flagged:false,date:UI.today()};
    Store.upsert('java',item);clearForm();renderList();Router.refreshBadges();UI.toast('Java question saved ✓','ok');
  }

  function deleteJava(id){if(!UI.confirm('Delete?'))return;Store.remove('java',id);renderList();Router.refreshBadges();}
  function editJava(id){
    const e=Store.get('java').find(x=>x.id===id);if(!e)return;
    editingId=id;
    document.getElementById('java-q').value=e.title;document.getElementById('java-cat').value=e.category;document.getElementById('java-diff').value=e.difficulty;document.getElementById('java-notes').value=e.notes||'';
    tagMgr.set(e.tags||[]);codeEditor.setTabs(e.codeTabs||[{id:'answer',label:'Code / Answer',code:'',complexity:''}]);
    document.getElementById('java-save-btn').textContent='✏️ Update Question';
    document.getElementById('java-form-anchor').scrollIntoView({behavior:'smooth'});
  }

  function renderList(){
    const q=(document.getElementById('java-search').value||'').toLowerCase();
    const list=Store.get('java').filter(e=>{
      const mC=filterCat==='All'||e.category===filterCat;
      const mQ=!q||e.title.toLowerCase().includes(q)||(e.notes||'').toLowerCase().includes(q);
      return mC&&mQ;
    });
    const el=document.getElementById('java-list');
    if(!list.length){el.innerHTML=UI.emptyState('code','No Java questions yet.');return;}
    el.innerHTML=`<div class="entries-list">${list.map(e=>UI.entryCardHTML(e,jAct(e))).join('')}</div>`;
    wire(el);
  }

  function jAct(e){return `<button class="iBtn" data-java-edit="${e.id}"><i class="ti ti-edit"></i></button><button class="iBtn del" data-java-del="${e.id}"><i class="ti ti-trash"></i></button>`;}

  function wire(el){
    el.querySelectorAll('[data-toggle]').forEach(btn=>{btn.addEventListener('click',()=>{UI.toggleCard(btn.dataset.toggle);renderList();});});
    el.querySelectorAll('.ebtab').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();UI.setCardBodyTab(btn.dataset.card,btn.dataset.tab);renderList();});});
    el.querySelectorAll('[data-java-edit]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();editJava(btn.dataset.javaEdit);});});
    el.querySelectorAll('[data-java-del]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();deleteJava(btn.dataset.javaDel);});});
    el.querySelectorAll('[data-copy]').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});});
  }
  return{render};
})();

/* ══════════════════════════════════════════
   INTERVIEWS
══════════════════════════════════════════ */
window.Pages.Interviews = (() => {
  let editingId=null,wired=false;
  const openSet=new Set();

  function render(){renderList();if(!wired){document.getElementById('int-save-btn').addEventListener('click',save);document.getElementById('int-clear-btn').addEventListener('click',clearForm);document.getElementById('int-search').addEventListener('input',renderList);wired=true;}}

  function clearForm(){
    editingId=null;
    ['int-company','int-role','int-round','int-date','int-questions','int-experience','int-outcome'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('int-status').value='Attended';
    document.getElementById('int-save-btn').textContent='💾 Save Experience';
  }

  function save(){
    const company=document.getElementById('int-company').value.trim();if(!company){UI.toast('Company required','err');return;}
    Store.upsert('interviews',{id:editingId||UI.uid(),company,role:document.getElementById('int-role').value.trim(),round:document.getElementById('int-round').value.trim(),date:document.getElementById('int-date').value||UI.today(),status:document.getElementById('int-status').value,questions:document.getElementById('int-questions').value.trim(),experience:document.getElementById('int-experience').value.trim(),outcome:document.getElementById('int-outcome').value.trim()});
    clearForm();renderList();Router.refreshBadges();UI.toast('Interview saved ✓','ok');
  }

  function deleteInt(id){if(!UI.confirm('Delete?'))return;Store.remove('interviews',id);renderList();Router.refreshBadges();}

  function editInt(id){
    const e=Store.get('interviews').find(x=>x.id===id);if(!e)return;
    editingId=id;
    document.getElementById('int-company').value=e.company||'';document.getElementById('int-role').value=e.role||'';document.getElementById('int-round').value=e.round||'';document.getElementById('int-date').value=e.date||'';document.getElementById('int-status').value=e.status||'Attended';document.getElementById('int-questions').value=e.questions||'';document.getElementById('int-experience').value=e.experience||'';document.getElementById('int-outcome').value=e.outcome||'';
    document.getElementById('int-save-btn').textContent='✏️ Update';
    document.getElementById('int-form-anchor').scrollIntoView({behavior:'smooth'});
  }

  function renderList(){
    const q=(document.getElementById('int-search').value||'').toLowerCase();
    const list=Store.get('interviews').filter(e=>!q||e.company.toLowerCase().includes(q)||(e.role||'').toLowerCase().includes(q)||(e.round||'').toLowerCase().includes(q));
    const el=document.getElementById('int-list');
    if(!list.length){el.innerHTML=UI.emptyState('building','No interview experiences logged yet.');return;}
    const sc=s=>s==='Selected'?'var(--green)':s==='Rejected'?'var(--red)':'var(--amber)';
    el.innerHTML=list.map(e=>`<div class="interview-card ${openSet.has(e.id)?'open':''}" id="ic-${e.id}">
      <div class="interview-card-header" data-int-toggle="${e.id}">
        <i class="ti ti-chevron-right entry-chevron"></i>
        <div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="interview-company">${UI.esc(e.company)}</span>
          ${e.role?`<span class="badge badge-status">${UI.esc(e.role)}</span>`:''}
          ${e.round?`<span class="badge badge-theory">${UI.esc(e.round)}</span>`:''}
          <span style="font-size:10px;font-family:var(--font-mono);padding:2px 8px;border-radius:99px;background:rgba(0,0,0,.2);color:${sc(e.status||'Attended')}">${e.status||'Attended'}</span>
        </div><div class="interview-round">${e.date?UI.fmtDate(e.date):''}</div></div>
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
  let pendingFile=null,pendingDataURL=null,wired=false;
  function render(){renderGrid();if(!wired){document.getElementById('res-save-btn').addEventListener('click',save);document.getElementById('res-file').addEventListener('change',onFile);wired=true;}}
  function onFile(e){
    const file=e.target.files[0];if(!file)return;
    if(file.type!=='application/pdf'){UI.toast('Only PDF files supported','err');return;}
    if(file.size>5*1024*1024){UI.toast('File too large (max 5MB)','err');return;}
    pendingFile=file;document.getElementById('res-file-label').textContent=file.name;
    const reader=new FileReader();reader.onload=ev=>{pendingDataURL=ev.target.result;};reader.readAsDataURL(file);
  }
  function save(){
    const label=document.getElementById('res-label').value.trim();if(!label){UI.toast('Enter a label','err');return;}if(!pendingDataURL){UI.toast('Select a PDF file','err');return;}
    Store.add('resumes',{id:UI.uid(),label,note:document.getElementById('res-note').value.trim(),fileName:pendingFile.name,dataURL:pendingDataURL,addedAt:new Date().toISOString()});
    document.getElementById('res-label').value='';document.getElementById('res-note').value='';document.getElementById('res-file').value='';document.getElementById('res-file-label').textContent='Click to select PDF…';
    pendingFile=null;pendingDataURL=null;renderGrid();Router.refreshBadges();UI.toast('Resume saved ✓','ok');
  }
  function download(id){const r=Store.get('resumes').find(x=>x.id===id);if(!r)return;const a=document.createElement('a');a.href=r.dataURL;a.download=r.fileName||'resume.pdf';a.click();}
  function del(id){if(!UI.confirm('Delete resume?'))return;Store.remove('resumes',id);renderGrid();UI.toast('Deleted','warn');}
  function renderGrid(){
    const resumes=Store.get('resumes');const el=document.getElementById('res-grid');
    if(!resumes.length){el.innerHTML=UI.emptyState('file-description','No resumes uploaded yet.');return;}
    el.innerHTML=`<div class="resume-grid">${resumes.map(r=>`<div class="resume-card"><div><div class="resume-card-title">${UI.esc(r.label)}</div><div class="resume-card-meta">${r.fileName||''} · ${new Date(r.addedAt).toLocaleDateString('en-GB')}</div>${r.note?`<div style="font-size:12px;color:var(--txt3);margin-top:4px;font-family:var(--font-mono)">${UI.esc(r.note)}</div>`:''}</div><div class="resume-actions"><button class="btn btn-primary btn-sm" data-dl="${r.id}"><i class="ti ti-download"></i> Download</button><button class="btn btn-danger btn-sm" data-del-res="${r.id}"><i class="ti ti-trash"></i></button></div></div>`).join('')}</div>`;
    el.querySelectorAll('[data-dl]').forEach(btn=>{btn.addEventListener('click',()=>download(btn.dataset.dl));});
    el.querySelectorAll('[data-del-res]').forEach(btn=>{btn.addEventListener('click',()=>del(btn.dataset.delRes));});
  }
  return{render};
})();
