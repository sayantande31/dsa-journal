/* ═══════════════════════════════════
   pages/problems.js  v2
   - Log form is now on a SEPARATE page (page-log)
   - Problems list is clean, filterable by date range (not just month)
   - YouTube links supported in videos field
═══════════════════════════════════ */
window.Pages = window.Pages || {};

/* ── Shared log form state ─────────────────────────────── */
window.Pages.LogForm = (() => {
  let tagMgr, codeEditor, editingId = null, wired = false;

  function init() {
    if (wired) return;
    document.getElementById('f-date').value = UI.today();
    tagMgr = UI.TagManager(document.getElementById('f-tags'), document.getElementById('f-tag-presets'));
    const cedWrap = document.getElementById('f-code-editor');
    cedWrap.id = 'ced-problems';
    codeEditor = UI.CodeEditor(cedWrap);
    document.getElementById('prob-save-btn').addEventListener('click', save);
    document.getElementById('prob-clear-btn').addEventListener('click', clear);
    wired = true;
  }

  function clear() {
    editingId = null;
    ['f-title','f-notes','f-link'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
    const fc=document.getElementById('f-cat');     if(fc) fc.value='DSA';
    const fd=document.getElementById('f-diff');    if(fd) fd.value='Medium';
    const fs=document.getElementById('f-status');  if(fs) fs.value='Solved';
    const fdate=document.getElementById('f-date'); if(fdate) fdate.value=UI.today();
    const fyt=document.getElementById('f-yt-links'); if(fyt) fyt.value='';
    tagMgr?.reset();
    codeEditor?.reset();
    const btn=document.getElementById('prob-save-btn');
    if(btn) btn.innerHTML='<i class="ti ti-device-floppy"></i> Save &amp; Sync';
    const tit=document.getElementById('form-section-title');
    if(tit) tit.textContent='Log Problem';
  }

  async function save() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { UI.toast('Please enter a title','err'); return; }

    // parse youtube / extra links
    const ytRaw = (document.getElementById('f-yt-links')?.value||'').trim();
    const ytLinks = ytRaw ? ytRaw.split('\n').map(l=>l.trim()).filter(Boolean) : [];

    const entry = {
      id:         editingId || UI.uid(),
      title,
      category:   document.getElementById('f-cat').value,
      difficulty: document.getElementById('f-diff').value,
      status:     document.getElementById('f-status').value,
      date:       document.getElementById('f-date').value || UI.today(),
      link:       document.getElementById('f-link').value.trim(),
      ytLinks,
      notes:      document.getElementById('f-notes').value.trim(),
      codeTabs:   codeEditor.getTabs(),
      tags:       tagMgr.getTags(),
      flagged:    false,
    };

    if (editingId) {
      const ex = Store.get('problems').find(p=>p.id===editingId);
      entry.flagged  = ex?.flagged  || false;
      entry.fromTodo = ex?.fromTodo || null;
      Store.upsert('problems', entry);
      UI.toast('Problem updated ✓','ok');
    } else {
      Store.add('problems', entry);
      UI.toast('Saved & syncing ✓','ok');
    }
    clear();
    Router.goto('problems');
  }

  function loadForEdit(id) {
    const e = Store.get('problems').find(p=>p.id===id); if (!e) return;
    editingId = id;
    document.getElementById('f-title').value  = e.title;
    document.getElementById('f-cat').value    = e.category;
    document.getElementById('f-diff').value   = e.difficulty;
    document.getElementById('f-status').value = e.status||'Solved';
    document.getElementById('f-date').value   = e.date||UI.today();
    document.getElementById('f-link').value   = e.link||'';
    document.getElementById('f-notes').value  = e.notes||'';
    const fyt = document.getElementById('f-yt-links');
    if (fyt) fyt.value = (e.ytLinks||[]).join('\n');
    tagMgr.set(e.tags||[]);
    codeEditor.setTabs(e.codeTabs?.length ? e.codeTabs : [
      {id:'brute',label:'Brute Force',code:'',complexity:''},
      {id:'optimal',label:'Optimal',code:'',complexity:''},
    ]);
    const btn = document.getElementById('prob-save-btn');
    if (btn) btn.innerHTML='<i class="ti ti-edit"></i> Update Problem';
    const tit = document.getElementById('form-section-title');
    if (tit) tit.textContent='Edit Problem';
    Router.goto('log');
    setTimeout(()=>document.getElementById('f-title')?.focus(), 100);
  }

  function render() { init(); }

  return { render, clear, loadForEdit };
})();

/* ── Problems list page ────────────────────────────────── */
window.Pages.Problems = (() => {
  let filterCat='All', filterDiff='All', filterStatus='All', wired=false;

  function render() {
    renderList();
    if (!wired) {
      document.querySelectorAll('#cat-filters .chip').forEach(el=>{
        el.addEventListener('click', ()=>{ filterCat=el.dataset.val; document.querySelectorAll('#cat-filters .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderList(); });
      });
      document.querySelectorAll('#diff-filters .chip').forEach(el=>{
        el.addEventListener('click', ()=>{ filterDiff=el.dataset.val; document.querySelectorAll('#diff-filters .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderList(); });
      });
      document.getElementById('prob-search').addEventListener('input', renderList);
      document.getElementById('prob-from').addEventListener('change', renderList);
      document.getElementById('prob-to').addEventListener('change', renderList);
      document.getElementById('prob-today-btn').addEventListener('click', ()=>{
        const t=UI.today(); document.getElementById('prob-from').value=t; document.getElementById('prob-to').value=t; renderList();
      });
      document.getElementById('prob-clear-dates').addEventListener('click', ()=>{
        document.getElementById('prob-from').value=''; document.getElementById('prob-to').value=''; renderList();
      });
      wired = true;
    }
  }

  function getFiltered() {
    const q    = (document.getElementById('prob-search').value||'').toLowerCase();
    const from =  document.getElementById('prob-from').value||'';
    const to   =  document.getElementById('prob-to').value||'';
    return Store.get('problems').filter(e => {
      const mCat  = filterCat==='All'  || e.category===filterCat;
      const mDiff = filterDiff==='All' || e.difficulty===filterDiff;
      const mDate = (!from||e.date>=from) && (!to||e.date<=to);
      const mQ    = !q||e.title.toLowerCase().includes(q)||(e.notes||'').toLowerCase().includes(q)||(e.tags||[]).some(t=>t.toLowerCase().includes(q))||(e.codeTabs||[]).some(t=>(t.code||'').toLowerCase().includes(q));
      return mCat && mDiff && mDate && mQ;
    });
  }

  function renderList() {
    const list = getFiltered();
    document.getElementById('prob-count-label').textContent = `${list.length} problem${list.length!==1?'s':''}`;
    const el = document.getElementById('prob-list');
    if (!list.length) { el.innerHTML = UI.emptyState('notes','No problems match your filters'); return; }
    el.innerHTML = `<div class="entries-list">${list.map(e=>UI.entryCardHTML(e,actions(e))).join('')}</div>`;
    wire(el);
  }

  function actions(e) {
    return `
      ${e.link?`<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn" title="Open link"><i class="ti ti-external-link"></i></a>`:''}
      <button class="iBtn ${e.flagged?'star-on':''}" data-flag="${e.id}" title="Revision"><i class="ti ti-star"></i></button>
      <button class="iBtn" data-edit="${e.id}" title="Edit"><i class="ti ti-edit"></i></button>
      <button class="iBtn del" data-del="${e.id}" title="Delete"><i class="ti ti-trash"></i></button>`;
  }

  function wire(container) {
    container.querySelectorAll('[data-toggle]').forEach(btn=>{
      btn.addEventListener('click',()=>{ UI.toggleCard(btn.dataset.toggle); renderList(); });
    });
    container.querySelectorAll('.ebtab').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.setCardBodyTab(btn.dataset.card,btn.dataset.tab);renderList();});
    });
    container.querySelectorAll('[data-flag]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();
        const p=Store.get('problems').find(x=>x.id===btn.dataset.flag);
        if(p){Store.update('problems',p.id,{flagged:!p.flagged});renderList();Router.refreshBadges();}
      });
    });
    container.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation(); Pages.LogForm.loadForEdit(btn.dataset.edit);});
    });
    container.querySelectorAll('[data-del]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();
        if(!UI.confirm('Delete this problem?')) return;
        Store.remove('problems',btn.dataset.del); UI.openCards.delete(btn.dataset.del); renderList(); Router.refreshBadges(); UI.toast('Deleted','warn');
      });
    });
    container.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});
    });
  }

  return { render };
})();
