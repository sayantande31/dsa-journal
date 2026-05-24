/* ═══════════════════════════════════
   pages/jobs.js  v1
   Job tracker: link, company, status, credentials
   Password masked with eye toggle
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Jobs = (() => {

  let editingId   = null;
  let filterStatus= 'All';
  let wired       = false;
  const openSet   = new Set();

  const STATUSES  = ['Wishlist','Applied','OA Sent','OA Done','Interview Scheduled','Interview Done','Offer','Rejected','Withdrawn'];
  const statusColor = s => ({
    'Offer':'var(--green)', 'Rejected':'var(--red)', 'Withdrawn':'var(--txt3)',
    'Interview Scheduled':'var(--blue)', 'Interview Done':'var(--blue)',
    'OA Sent':'var(--purple)', 'OA Done':'var(--purple)',
    'Applied':'var(--accent)', 'Wishlist':'var(--amber)',
  }[s] || 'var(--txt3)');

  function render() {
    renderStatusFilter();
    renderList();
    if (!wired) {
      document.getElementById('job-save-btn').addEventListener('click', save);
      document.getElementById('job-clear-btn').addEventListener('click', clearForm);
      document.getElementById('job-search').addEventListener('input', renderList);
      document.getElementById('job-date-from').addEventListener('change', renderList);
      document.getElementById('job-date-to').addEventListener('change', renderList);
      document.getElementById('job-clear-dates').addEventListener('click', ()=>{
        document.getElementById('job-date-from').value='';
        document.getElementById('job-date-to').value='';
        renderList();
      });
      wired = true;
    }
  }

  function renderStatusFilter() {
    const el = document.getElementById('job-status-filter');
    if (el._built) return;
    el.innerHTML = ['All',...STATUSES].map(s =>
      `<button class="chip ${s===filterStatus?'active':''}" data-jst="${UI.esc(s)}">${UI.esc(s)}</button>`
    ).join('');
    el.addEventListener('click', e => {
      const chip = e.target.closest('[data-jst]'); if (!chip) return;
      filterStatus = chip.dataset.jst;
      el.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      renderList();
    });
    el._built = true;
  }

  function clearForm() {
    editingId = null;
    ['job-company','job-role','job-link','job-portal','job-username','job-password','job-notes','job-date'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    document.getElementById('job-status').value='Wishlist';
    document.getElementById('job-date').value=UI.today();
    document.getElementById('job-save-btn').textContent='💾 Save Job';
  }

  function save() {
    const company = document.getElementById('job-company').value.trim();
    if (!company) { UI.toast('Company name required','err'); return; }
    const item = {
      id:       editingId||UI.uid(),
      company,
      role:     document.getElementById('job-role').value.trim(),
      link:     document.getElementById('job-link').value.trim(),
      portal:   document.getElementById('job-portal').value.trim(),
      username: document.getElementById('job-username').value.trim(),
      password: document.getElementById('job-password').value,
      status:   document.getElementById('job-status').value,
      date:     document.getElementById('job-date').value||UI.today(),
      notes:    document.getElementById('job-notes').value.trim(),
      updatedAt:new Date().toISOString(),
    };
    Store.upsert('jobs', item);
    clearForm(); renderList(); Router.refreshBadges();
    UI.toast('Job saved ✓','ok');
  }

  function editJob(id) {
    const j = Store.get('jobs').find(x=>x.id===id); if (!j) return;
    editingId = id;
    document.getElementById('job-company').value  = j.company||'';
    document.getElementById('job-role').value     = j.role||'';
    document.getElementById('job-link').value     = j.link||'';
    document.getElementById('job-portal').value   = j.portal||'';
    document.getElementById('job-username').value = j.username||'';
    document.getElementById('job-password').value = j.password||'';
    document.getElementById('job-status').value   = j.status||'Wishlist';
    document.getElementById('job-date').value     = j.date||UI.today();
    document.getElementById('job-notes').value    = j.notes||'';
    document.getElementById('job-save-btn').textContent='✏️ Update Job';
    document.getElementById('job-form-anchor').scrollIntoView({behavior:'smooth'});
  }

  function deleteJob(id) {
    if (!UI.confirm('Delete this job entry?')) return;
    Store.remove('jobs',id); openSet.delete(id); renderList(); Router.refreshBadges();
    UI.toast('Deleted','warn');
  }

  function getFiltered() {
    const q    = (document.getElementById('job-search').value||'').toLowerCase();
    const from = document.getElementById('job-date-from').value||'';
    const to   = document.getElementById('job-date-to').value||'';
    return Store.get('jobs').filter(j => {
      const mSt = filterStatus==='All' || j.status===filterStatus;
      const mQ  = !q || j.company.toLowerCase().includes(q)||(j.role||'').toLowerCase().includes(q)||(j.portal||'').toLowerCase().includes(q);
      const mD  = (!from||j.date>=from) && (!to||j.date<=to);
      return mSt && mQ && mD;
    });
  }

  function renderList() {
    const list = getFiltered();
    const el   = document.getElementById('job-list');
    document.getElementById('job-count-label').textContent = `${list.length} job${list.length!==1?'s':''}`;
    if (!list.length) { el.innerHTML=UI.emptyState('briefcase','No jobs match your filters'); return; }

    // group by status for kanban-style view
    el.innerHTML = list.map(j => {
      const isOpen = openSet.has(j.id);
      const sc = statusColor(j.status);
      return `<div class="interview-card ${isOpen?'open':''}" id="jc-${j.id}">
        <div class="interview-card-header" data-job-toggle="${j.id}">
          <i class="ti ti-chevron-right entry-chevron"></i>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="interview-company">${UI.esc(j.company)}</span>
              ${j.role?`<span class="badge badge-status">${UI.esc(j.role)}</span>`:''}
              <span style="font-size:10px;font-family:var(--font-mono);padding:2px 9px;border-radius:99px;background:rgba(0,0,0,.25);color:${sc};border:1px solid ${sc}40">${j.status}</span>
            </div>
            <div class="interview-round" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:3px">
              ${j.date?`<span>${UI.fmtDate(j.date)}</span>`:''}
              ${j.portal?`<span style="color:var(--blue)">${UI.esc(j.portal)}</span>`:''}
            </div>
          </div>
          <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
            ${j.link?`<a href="${UI.esc(j.link)}" target="_blank" rel="noopener" class="iBtn" title="Job link"><i class="ti ti-external-link"></i></a>`:''}
            <button class="iBtn" data-job-edit="${j.id}" title="Edit"><i class="ti ti-edit"></i></button>
            <button class="iBtn del" data-job-del="${j.id}" title="Delete"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        ${isOpen?`<div class="interview-body">
          ${j.notes?`<div class="section-label" style="margin-bottom:6px">Notes</div><div class="notes-block" style="margin-bottom:1rem">${UI.esc(j.notes)}</div>`:''}
          ${(j.username||j.password)?`<div class="section-label" style="margin-bottom:6px">Portal credentials</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:.5rem">
              ${j.username?`<div>
                <div class="flabel" style="margin-bottom:3px">Username / Email</div>
                <div style="font-family:var(--font-mono);font-size:12px;background:var(--bg3);padding:6px 10px;border-radius:var(--r);display:flex;gap:8px;align-items:center">
                  <span>${UI.esc(j.username)}</span>
                  <button class="copy-btn" style="position:static" data-copy="${UI.esc(j.username)}">copy</button>
                </div>
              </div>`:''}
              ${j.password?`<div>
                <div class="flabel" style="margin-bottom:3px">Password</div>
                <div style="font-family:var(--font-mono);font-size:12px;background:var(--bg3);padding:6px 10px;border-radius:var(--r);display:flex;gap:8px;align-items:center">
                  <span id="pw-${j.id}" style="letter-spacing:.1em">••••••••</span>
                  <button class="iBtn" onclick="Pages.Jobs._togglePw('${j.id}','${UI.esc(j.password)}')" title="Show/hide" style="font-size:14px;padding:2px 4px"><i class="ti ti-eye"></i></button>
                  <button class="copy-btn" style="position:static" data-copy="${UI.esc(j.password)}">copy</button>
                </div>
              </div>`:''}
            </div>`:''}
        </div>`:''}
      </div>`;
    }).join('');

    el.querySelectorAll('[data-job-toggle]').forEach(btn=>{
      btn.addEventListener('click',()=>{ const id=btn.dataset.jobToggle; if(openSet.has(id)) openSet.delete(id); else openSet.add(id); renderList(); });
    });
    el.querySelectorAll('[data-job-edit]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();editJob(btn.dataset.jobEdit);});
    });
    el.querySelectorAll('[data-job-del]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();deleteJob(btn.dataset.jobDel);});
    });
    el.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});
    });
  }

  return {
    render,
    _togglePw: (id, pw) => {
      const el = document.getElementById('pw-'+id); if (!el) return;
      el.textContent = el.textContent.includes('•') ? pw : '••••••••';
    },
  };
})();
