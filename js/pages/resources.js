/* ═══════════════════════════════════════════════════
   pages/resources.js — v4.0 [2025-prompt-4]
   Features:
   - Upload PDFs (stored as base64, viewable in-browser)
   - YouTube links with auto-thumbnail
   - Any URL / article / media type
   - Star rating 1-5
   - Topic grouping view toggle
   - Search + filter by type / topic / rating / status
   - Edit all fields inline
   - Progress: To watch / Watching / Done
   - In-browser document viewer (no download needed)
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Resources = (() => {
  let editingId      = null;
  let pendingFile    = null;
  let pendingDataURL = null;
  let filterTopic    = 'All';
  let filterType     = 'All';
  let filterRating   = 0;

  const TYPE_ICONS = {
    youtube: 'ti-brand-youtube',
    pdf:     'ti-file-type-pdf',
    link:    'ti-link',
    article: 'ti-article',
  };

  /* ── Entry point ─────────────────────────────── */
  function render() {
    initForm();
    buildTopicFilter();
    renderGrid();
    wireFilterControls();
  }

  /* ── Form wiring (once) ──────────────────────── */
  function initForm() {
    const saveBtn = document.getElementById('res2-save-btn');
    if (!saveBtn || saveBtn._wired) return;

    saveBtn.addEventListener('click', saveResource);
    document.getElementById('res2-clear-btn')?.addEventListener('click', clearForm);
    document.getElementById('res2-file')?.addEventListener('change', onFileChange);
    document.getElementById('res2-url')?.addEventListener('input', autoDetectType);

    // Star rating
    document.querySelectorAll('.res2-star-btn').forEach(s => {
      s.addEventListener('click', () => {
        const v = parseInt(s.dataset.val);
        document.getElementById('res2-rating-val').value = v;
        updateStarUI(v);
      });
      s.addEventListener('mouseover', () => updateStarUI(parseInt(s.dataset.val)));
      s.addEventListener('mouseout',  () => updateStarUI(parseInt(document.getElementById('res2-rating-val')?.value || '0')));
    });

    saveBtn._wired = true;
  }

  function wireFilterControls() {
    const searchEl = document.getElementById('res2-search');
    if (searchEl && !searchEl._wired) {
      searchEl.addEventListener('input', renderGrid);
      searchEl._wired = true;
    }
    const typeEl = document.getElementById('res2-filter-type');
    if (typeEl && !typeEl._wired) {
      typeEl.addEventListener('change', () => { filterType = typeEl.value; renderGrid(); });
      typeEl._wired = true;
    }
    const ratEl = document.getElementById('res2-filter-rating');
    if (ratEl && !ratEl._wired) {
      ratEl.addEventListener('change', () => { filterRating = parseInt(ratEl.value || '0'); renderGrid(); });
      ratEl._wired = true;
    }
    const topicEl = document.getElementById('res2-filter-topic');
    if (topicEl && !topicEl._wired) {
      topicEl.addEventListener('change', () => { filterTopic = topicEl.value; renderGrid(); });
      topicEl._wired = true;
    }
    const modeEl = document.getElementById('res2-view-mode');
    if (modeEl && !modeEl._wired) {
      modeEl.addEventListener('change', renderGrid);
      modeEl._wired = true;
    }
  }

  function autoDetectType() {
    const url    = document.getElementById('res2-url')?.value.trim() || '';
    const typeEl = document.getElementById('res2-type');
    if (!typeEl) return;
    if (url.includes('youtube.com') || url.includes('youtu.be')) typeEl.value = 'youtube';
    else if (url.match(/\.(pdf)(\?.*)?$/i))                       typeEl.value = 'pdf';
    else if (url)                                                  typeEl.value = 'link';
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { UI.toast('File too large (max 25MB)', 'err'); return; }
    pendingFile = file;
    const lbl = document.getElementById('res2-file-label');
    if (lbl) lbl.textContent = file.name;
    if (file.type === 'application/pdf') {
      const te = document.getElementById('res2-type'); if (te) te.value = 'pdf';
    }
    const reader = new FileReader();
    reader.onload = ev => { pendingDataURL = ev.target.result; };
    reader.readAsDataURL(file);
  }

  function updateStarUI(val) {
    document.querySelectorAll('.res2-star-btn').forEach(s => {
      s.style.color = parseInt(s.dataset.val) <= val ? 'var(--amber)' : 'var(--txt4)';
      s.style.fontSize = '18px';
    });
  }

  function clearForm() {
    editingId = null; pendingFile = null; pendingDataURL = null;
    ['res2-title','res2-url','res2-topic','res2-notes','res2-tags','res2-extra-links'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const te = document.getElementById('res2-type');   if (te) te.value = 'link';
    const se = document.getElementById('res2-status'); if (se) se.value = 'To watch';
    const re = document.getElementById('res2-rating-val'); if (re) re.value = '0';
    updateStarUI(0);
    const fi = document.getElementById('res2-file'); if (fi) fi.value = '';
    const fl = document.getElementById('res2-file-label'); if (fl) fl.textContent = 'Optional: upload PDF or image…';
    const sb = document.getElementById('res2-save-btn'); if (sb) sb.innerHTML = '<i class="ti ti-device-floppy"></i> Save Resource';
    const ft = document.getElementById('res2-form-title'); if (ft) ft.textContent = 'Add Resource';
  }

  async function saveResource() {
    const title = document.getElementById('res2-title')?.value.trim() || '';
    if (!title) { UI.toast('Title is required', 'err'); return; }
    const url        = document.getElementById('res2-url')?.value.trim()    || '';
    const type       = document.getElementById('res2-type')?.value          || 'link';
    const topic      = document.getElementById('res2-topic')?.value.trim()  || '';
    const notes      = document.getElementById('res2-notes')?.value.trim()  || '';
    const status     = document.getElementById('res2-status')?.value        || 'To watch';
    const rating     = parseInt(document.getElementById('res2-rating-val')?.value || '0');
    const tagsRaw    = document.getElementById('res2-tags')?.value           || '';
    const extraLinks = (document.getElementById('res2-extra-links')?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const tags       = [...new Set([...tagsRaw.split(',').map(t => t.trim()).filter(Boolean), ...(topic ? [topic] : [])])];

    if (!url && !pendingDataURL) { UI.toast('Add a URL or upload a file', 'err'); return; }

    const existing = editingId ? Store.get('resources').find(r => r.id === editingId) : null;
    Store.upsert('resources', {
      id:         editingId || UI.uid(),
      title, url, type, topic, notes, status, rating, tags, extraLinks,
      fileName:   pendingFile?.name   || existing?.fileName || '',
      dataURL:    pendingDataURL      || existing?.dataURL  || '',
      addedAt:    existing?.addedAt   || new Date().toISOString(),
    });
    clearForm();
    buildTopicFilter();
    renderGrid();
    Router.refreshBadges();
    UI.toast('Resource saved ✓', 'ok');
  }

  function editResource(id) {
    const r = Store.get('resources').find(x => x.id === id); if (!r) return;
    editingId = id; pendingDataURL = r.dataURL || ''; pendingFile = r.fileName ? { name: r.fileName } : null;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
    set('res2-title',       r.title       || '');
    set('res2-url',         r.url         || '');
    set('res2-type',        r.type        || 'link');
    set('res2-topic',       r.topic       || '');
    set('res2-notes',       r.notes       || '');
    set('res2-status',      r.status      || 'To watch');
    set('res2-rating-val',  r.rating      || 0);
    set('res2-tags',        (r.tags || []).filter(t => t !== r.topic).join(', '));
    set('res2-extra-links', (r.extraLinks || []).join('\n'));
    updateStarUI(r.rating || 0);
    if (r.fileName) { const fl = document.getElementById('res2-file-label'); if (fl) fl.textContent = r.fileName; }
    const sb = document.getElementById('res2-save-btn'); if (sb) sb.innerHTML = '<i class="ti ti-edit"></i> Update Resource';
    const ft = document.getElementById('res2-form-title'); if (ft) ft.textContent = 'Edit Resource';
    document.getElementById('res2-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }

  function deleteResource(id) {
    if (!UI.confirm('Delete this resource?')) return;
    Store.remove('resources', id);
    buildTopicFilter();
    renderGrid();
    Router.refreshBadges();
    UI.toast('Deleted', 'warn');
  }

  function buildTopicFilter() {
    const resources = Store.get('resources');
    const topics    = ['All', ...new Set(resources.map(r => r.topic || 'Uncategorised').filter(Boolean).sort())];
    const el        = document.getElementById('res2-filter-topic');
    if (!el) return;
    const cur = el.value;
    el.innerHTML = topics.map(t => `<option value="${UI.esc(t)}" ${t === cur ? 'selected' : ''}>${UI.esc(t)}</option>`).join('');
  }

  function getFiltered() {
    const q      = (document.getElementById('res2-search')?.value || '').toLowerCase();
    const topic  = document.getElementById('res2-filter-topic')?.value  || 'All';
    const type   = document.getElementById('res2-filter-type')?.value   || 'All';
    const minRat = parseInt(document.getElementById('res2-filter-rating')?.value || '0');
    return Store.get('resources').filter(r => {
      const mTopic  = topic === 'All' || (r.topic || 'Uncategorised') === topic;
      const mType   = type  === 'All' || r.type  === type;
      const mRating = (r.rating || 0) >= minRat;
      const mQ      = !q || r.title.toLowerCase().includes(q) || (r.topic || '').toLowerCase().includes(q)
                       || (r.notes || '').toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q));
      return mTopic && mType && mRating && mQ;
    });
  }

  function ytThumb(url) {
    try {
      const u = new URL(url); let vid = '';
      if (u.hostname.includes('youtube.com')) vid = u.searchParams.get('v');
      else if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1);
      return vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : '';
    } catch { return ''; }
  }

  function starDisplayHTML(rating) {
    return [1,2,3,4,5].map(i =>
      `<i class="ti ti-star${i <= (rating || 0) ? '-filled' : ''}" style="color:${i <= (rating || 0) ? 'var(--amber)' : 'var(--txt4)'};font-size:12px"></i>`
    ).join('');
  }

  function cardHTML(r) {
    const thumb = r.type === 'youtube' ? ytThumb(r.url) : '';
    const icon  = TYPE_ICONS[r.type] || 'ti-link';
    const sc    = { Done: 'var(--green)', Watching: 'var(--amber)', 'To watch': 'var(--txt3)' }[r.status] || 'var(--txt3)';
    return `<div class="res2-card">
      <div class="res2-thumb" data-res-view="${r.id}" style="cursor:pointer">
        ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : ''}
        <i class="ti ${icon}" style="font-size:28px;color:var(--txt4);${thumb?'display:none':''}"></i>
        <div class="res2-overlay"><i class="ti ti-eye" style="font-size:20px;color:#fff"></i></div>
      </div>
      <div class="res2-info">
        <div class="res2-card-title">${UI.esc(r.title)}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:3px 0">
          ${r.topic ? `<span class="badge badge-theory">${UI.esc(r.topic)}</span>` : ''}
          <span style="color:${sc};font-size:10px;font-family:var(--font-mono)">${r.status}</span>
        </div>
        <div style="margin-bottom:4px">${starDisplayHTML(r.rating)}</div>
        ${r.notes ? `<div style="font-size:11px;color:var(--txt3);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(r.notes.substring(0, 70))}</div>` : ''}
      </div>
      <div class="res2-card-actions">
        ${r.url ? `<a href="${UI.esc(r.url)}" target="_blank" rel="noopener" class="iBtn" title="Open URL"><i class="ti ti-external-link"></i></a>` : ''}
        <button class="iBtn" data-res-view="${r.id}" title="Preview / View"><i class="ti ti-eye"></i></button>
        <button class="iBtn" data-res-edit="${r.id}" title="Edit"><i class="ti ti-edit"></i></button>
        <button class="iBtn del" data-res-del="${r.id}" title="Delete"><i class="ti ti-trash"></i></button>
      </div>
      <div style="padding:0 8px 8px">
        <select data-res-status="${r.id}" style="width:100%;font-size:10px;padding:3px 6px;background:var(--bg3);border:1px solid var(--line2);border-radius:var(--r);color:var(--txt2);font-family:var(--font-mono);cursor:pointer">
          ${['To watch','Watching','Done'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }

  function renderGrid() {
    const mode = document.getElementById('res2-view-mode')?.value || 'grid';
    const list = getFiltered();
    const el   = document.getElementById('res2-list');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = UI.emptyState('books', 'No resources match your filters. Add one above!');
      return;
    }

    if (mode === 'topic') {
      const groups = {};
      list.forEach(r => { const g = r.topic || 'Uncategorised'; if (!groups[g]) groups[g] = []; groups[g].push(r); });
      el.innerHTML = Object.keys(groups).sort().map(g => `
        <div style="margin-bottom:1.75rem">
          <div class="section-label">${UI.esc(g)} <span style="color:var(--txt3)">(${groups[g].length})</span></div>
          <div class="res2-grid">${groups[g].map(r => cardHTML(r)).join('')}</div>
        </div>`).join('');
    } else {
      el.innerHTML = `<div class="res2-grid">${list.map(r => cardHTML(r)).join('')}</div>`;
    }
    wireGrid(el);
  }

  function wireGrid(el) {
    el.querySelectorAll('[data-res-view]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); viewResource(btn.dataset.resView); });
    });
    el.querySelectorAll('[data-res-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); editResource(btn.dataset.resEdit); });
    });
    el.querySelectorAll('[data-res-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteResource(btn.dataset.resDel); });
    });
    el.querySelectorAll('[data-res-status]').forEach(sel => {
      sel.addEventListener('change', e => {
        e.stopPropagation();
        Store.update('resources', sel.dataset.resStatus, { status: sel.value });
        UI.toast(`Marked "${sel.value}" ✓`, 'ok');
      });
    });
  }

  function viewResource(id) {
    const r = Store.get('resources').find(x => x.id === id); if (!r) return;
    // YouTube → open tab
    if (r.type === 'youtube' && r.url) { window.open(r.url, '_blank', 'noopener'); return; }
    // Has uploaded file → show in viewer
    if (r.dataURL) {
      const overlay = document.getElementById('doc-viewer-overlay');
      const frame   = document.getElementById('doc-viewer-frame');
      const title   = document.getElementById('doc-viewer-title');
      if (!overlay || !frame) return;
      if (title) title.textContent = r.title;
      frame.src = r.dataURL;
      overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      return;
    }
    // Regular URL → open tab
    if (r.url) { window.open(r.url, '_blank', 'noopener'); }
  }

  function closeViewer() {
    const overlay = document.getElementById('doc-viewer-overlay');
    const frame   = document.getElementById('doc-viewer-frame');
    if (overlay) overlay.classList.add('hidden');
    if (frame)   frame.src = '';
    document.body.style.overflow = '';
  }

  return { render, closeViewer };
})();
