/* ═══════════════════════════════════════════════════
   pages/resources.js  — v4.0  [2025-prompt-4]
   Full resource management:
   - Upload PDFs (base64), YouTube links, any URL
   - Tags-based search and filtering
   - Group-by-topic view
   - Edit any field inline
   - Star rating (1–5)
   - In-browser PDF viewer (no download required)
   - Progress tracking: To Watch / Watching / Done
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Resources = (() => {

  let editingId    = null;
  let filterTopic  = 'All';
  let filterType   = 'All';
  let filterRating = 0;
  let viewMode     = 'grid';   // 'grid' | 'topic'
  let pendingFile  = null;
  let pendingDataURL = null;

  const TYPE_ICONS = {
    youtube: 'ti-brand-youtube',
    pdf:     'ti-file-type-pdf',
    link:    'ti-link',
    article: 'ti-article',
  };

  /* ── Render entry point ──────────────────────── */
  function render() {
    renderFilters();
    renderResources();
    initForm();
  }

  /* ── Form init (once per DOM lifecycle) ───────── */
  function initForm() {
    const saveBtn = document.getElementById('res2-save-btn');
    if (!saveBtn || saveBtn._wired) return;

    saveBtn.addEventListener('click', saveResource);
    document.getElementById('res2-clear-btn')?.addEventListener('click', clearForm);
    document.getElementById('res2-file')?.addEventListener('change', onFileChange);
    document.getElementById('res2-url')?.addEventListener('blur', autoDetectType);
    document.getElementById('res2-url')?.addEventListener('input', autoDetectType);

    // Star rating wiring
    document.querySelectorAll('.res2-star').forEach(star => {
      star.addEventListener('click', () => {
        const v = parseInt(star.dataset.val);
        document.getElementById('res2-rating-val').value = v;
        updateStarUI(v);
      });
    });

    saveBtn._wired = true;
  }

  function autoDetectType() {
    const url = document.getElementById('res2-url')?.value.trim() || '';
    const typeEl = document.getElementById('res2-type');
    if (!typeEl) return;
    if (url.includes('youtube.com') || url.includes('youtu.be')) typeEl.value = 'youtube';
    else if (url.match(/\.(pdf)(\?.*)?$/i)) typeEl.value = 'pdf';
    else if (url) typeEl.value = 'link';
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { UI.toast('File too large (max 20MB)', 'err'); return; }
    pendingFile = file;
    const labelEl = document.getElementById('res2-file-label');
    if (labelEl) labelEl.textContent = file.name;
    const typeEl = document.getElementById('res2-type');
    if (typeEl && file.type === 'application/pdf') typeEl.value = 'pdf';
    const reader = new FileReader();
    reader.onload = ev => { pendingDataURL = ev.target.result; };
    reader.readAsDataURL(file);
  }

  function updateStarUI(val) {
    document.querySelectorAll('.res2-star').forEach(s => {
      const sv = parseInt(s.dataset.val);
      s.style.color = sv <= val ? 'var(--amber)' : 'var(--txt4)';
    });
  }

  function clearForm() {
    editingId = null; pendingFile = null; pendingDataURL = null;
    ['res2-title','res2-url','res2-topic','res2-notes','res2-tags'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const typeEl = document.getElementById('res2-type');   if (typeEl) typeEl.value = 'link';
    const stEl   = document.getElementById('res2-status'); if (stEl) stEl.value = 'To watch';
    const ratingEl = document.getElementById('res2-rating-val'); if (ratingEl) ratingEl.value = '0';
    updateStarUI(0);
    const fileInp = document.getElementById('res2-file'); if (fileInp) fileInp.value = '';
    const fileLabel = document.getElementById('res2-file-label'); if (fileLabel) fileLabel.textContent = 'Optional: upload PDF…';
    const saveBtn = document.getElementById('res2-save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Save Resource';
    const formTitle = document.getElementById('res2-form-title');
    if (formTitle) formTitle.textContent = 'Add Resource';
  }

  async function saveResource() {
    const title = document.getElementById('res2-title')?.value.trim() || '';
    if (!title) { UI.toast('Title is required', 'err'); return; }

    const url      = document.getElementById('res2-url')?.value.trim()    || '';
    const type     = document.getElementById('res2-type')?.value          || 'link';
    const topic    = document.getElementById('res2-topic')?.value.trim()  || '';
    const notes    = document.getElementById('res2-notes')?.value.trim()  || '';
    const status   = document.getElementById('res2-status')?.value        || 'To watch';
    const rating   = parseInt(document.getElementById('res2-rating-val')?.value || '0');
    const tagsRaw  = document.getElementById('res2-tags')?.value          || '';
    const tags     = [
      ...tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      ...(topic ? [topic] : []),
    ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

    if (!url && !pendingDataURL) { UI.toast('Add a URL or upload a file', 'err'); return; }

    const item = {
      id:       editingId || UI.uid(),
      title,
      url,
      type,
      topic,
      notes,
      status,
      rating,
      tags,
      fileName: pendingFile?.name || '',
      dataURL:  pendingDataURL || '',
      addedAt:  editingId
        ? (Store.get('resources').find(r => r.id === editingId)?.addedAt || new Date().toISOString())
        : new Date().toISOString(),
    };

    Store.upsert('resources', item);
    clearForm();
    renderFilters();
    renderResources();
    Router.refreshBadges();
    UI.toast('Resource saved ✓', 'ok');
  }

  function editResource(id) {
    const r = Store.get('resources').find(x => x.id === id);
    if (!r) return;
    editingId = id;
    pendingDataURL = r.dataURL || '';
    pendingFile    = r.fileName ? { name: r.fileName } : null;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
    set('res2-title',  r.title  || '');
    set('res2-url',    r.url    || '');
    set('res2-type',   r.type   || 'link');
    set('res2-topic',  r.topic  || '');
    set('res2-notes',  r.notes  || '');
    set('res2-status', r.status || 'To watch');
    set('res2-rating-val', r.rating || 0);
    set('res2-tags',   (r.tags||[]).filter(t => t !== r.topic).join(', '));
    updateStarUI(r.rating || 0);
    if (r.fileName) {
      const fl = document.getElementById('res2-file-label');
      if (fl) fl.textContent = r.fileName;
    }
    const saveBtn = document.getElementById('res2-save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-edit"></i> Update Resource';
    const formTitle = document.getElementById('res2-form-title');
    if (formTitle) formTitle.textContent = 'Edit Resource';
    document.getElementById('res2-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
  }

  function deleteResource(id) {
    if (!UI.confirm('Delete this resource?')) return;
    Store.remove('resources', id);
    renderFilters();
    renderResources();
    Router.refreshBadges();
    UI.toast('Deleted', 'warn');
  }

  /* ── Filters ──────────────────────────────────── */
  function renderFilters() {
    const resources = Store.get('resources');
    const topics = ['All', ...new Set(resources.map(r => r.topic || 'Uncategorised').filter(Boolean))];
    const topicEl = document.getElementById('res2-filter-topic');
    if (topicEl) {
      const cur = topicEl.value;
      topicEl.innerHTML = topics.map(t => `<option value="${UI.esc(t)}" ${t===cur?'selected':''}>${UI.esc(t)}</option>`).join('');
    }
  }

  function getFiltered() {
    const q       = (document.getElementById('res2-search')?.value || '').toLowerCase();
    const topic   = document.getElementById('res2-filter-topic')?.value  || 'All';
    const type    = document.getElementById('res2-filter-type')?.value   || 'All';
    const minRat  = parseInt(document.getElementById('res2-filter-rating')?.value || '0');
    return Store.get('resources').filter(r => {
      const mTopic  = topic === 'All' || (r.topic || 'Uncategorised') === topic;
      const mType   = type  === 'All' || r.type  === type;
      const mRating = r.rating >= minRat;
      const mQ      = !q
        || r.title.toLowerCase().includes(q)
        || (r.topic  || '').toLowerCase().includes(q)
        || (r.notes  || '').toLowerCase().includes(q)
        || (r.tags   || []).some(t => t.toLowerCase().includes(q));
      return mTopic && mType && mRating && mQ;
    });
  }

  /* ── Render resources ─────────────────────────── */
  function renderResources() {
    const mode = document.getElementById('res2-view-mode')?.value || 'grid';
    const list = getFiltered();
    const el   = document.getElementById('res2-list');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = UI.emptyState('books', 'No resources match your filters. Add one above!');
      return;
    }

    if (mode === 'topic') {
      // Group by topic
      const groups = {};
      list.forEach(r => {
        const g = r.topic || 'Uncategorised';
        if (!groups[g]) groups[g] = [];
        groups[g].push(r);
      });
      el.innerHTML = Object.keys(groups).sort().map(g => `
        <div style="margin-bottom:1.75rem">
          <div class="section-label">${UI.esc(g)} <span style="color:var(--txt3);font-size:10px">(${groups[g].length})</span></div>
          <div class="res2-grid">${groups[g].map(r => resourceCardHTML(r)).join('')}</div>
        </div>`).join('');
    } else {
      el.innerHTML = `<div class="res2-grid">${list.map(r => resourceCardHTML(r)).join('')}</div>`;
    }
    wireResources(el);
  }

  function ytThumb(url) {
    try {
      const u = new URL(url);
      let vid = '';
      if (u.hostname.includes('youtube.com')) vid = u.searchParams.get('v');
      else if (u.hostname.includes('youtu.be')) vid = u.pathname.slice(1);
      return vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : '';
    } catch { return ''; }
  }

  function starHTML(rating) {
    return [1,2,3,4,5].map(i => `<i class="ti ti-star${i <= rating ? '-filled' : ''}" style="color:${i <= rating ? 'var(--amber)' : 'var(--txt4)'}; font-size:12px"></i>`).join('');
  }

  function resourceCardHTML(r) {
    const thumb = r.type === 'youtube' ? ytThumb(r.url) : '';
    const icon  = TYPE_ICONS[r.type] || 'ti-link';
    const statusColor = { 'Done':'var(--green)', 'Watching':'var(--amber)', 'To watch':'var(--txt3)' }[r.status] || 'var(--txt3)';

    return `<div class="res2-card" id="rc-${r.id}">
      <div class="res2-thumb" data-view="${r.id}">
        ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<i class=\\'ti ${icon}\\' style=\\'font-size:28px;color:var(--txt4)\\'></i>'"/>` : `<i class="ti ${icon}" style="font-size:28px;color:var(--txt4)"></i>`}
        <div class="res2-thumb-overlay"><i class="ti ti-eye" style="font-size:22px;color:#fff"></i></div>
      </div>
      <div class="res2-info">
        <div class="res2-title">${UI.esc(r.title)}</div>
        <div class="res2-meta">
          ${r.topic ? `<span class="badge badge-theory">${UI.esc(r.topic)}</span>` : ''}
          <span style="color:${statusColor};font-size:10px;font-family:var(--font-mono)">${r.status}</span>
        </div>
        <div class="res2-stars">${starHTML(r.rating || 0)}</div>
        ${r.notes ? `<div class="res2-notes">${UI.esc(r.notes.substring(0,80))}${r.notes.length>80?'…':''}</div>` : ''}
        ${(r.tags||[]).filter(t=>t!==r.topic).length
          ? `<div class="res2-tags">${(r.tags||[]).filter(t=>t!==r.topic).map(t=>`<span class="etag">${UI.esc(t)}</span>`).join('')}</div>`
          : ''}
      </div>
      <div class="res2-actions">
        ${r.url ? `<a href="${UI.esc(r.url)}" target="_blank" rel="noopener" class="iBtn" title="Open URL"><i class="ti ti-external-link"></i></a>` : ''}
        <button class="iBtn" data-res-view="${r.id}" title="View / Preview"><i class="ti ti-eye"></i></button>
        <button class="iBtn" data-res-edit="${r.id}" title="Edit"><i class="ti ti-edit"></i></button>
        <select class="res2-status-sel" data-res-status="${r.id}" title="Update progress" style="font-size:10px;padding:2px 4px;border-radius:var(--r);background:var(--bg3);border:1px solid var(--line2);color:var(--txt2);font-family:var(--font-mono);cursor:pointer">
          ${['To watch','Watching','Done'].map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class="iBtn del" data-res-del="${r.id}" title="Delete"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }

  function wireResources(container) {
    // Thumb click → view
    container.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', () => viewResource(el.dataset.view));
    });
    container.querySelectorAll('[data-res-view]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); viewResource(btn.dataset.resView); });
    });
    container.querySelectorAll('[data-res-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); editResource(btn.dataset.resEdit); });
    });
    container.querySelectorAll('[data-res-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteResource(btn.dataset.resDel); });
    });
    container.querySelectorAll('[data-res-status]').forEach(sel => {
      sel.addEventListener('change', e => {
        e.stopPropagation();
        Store.update('resources', sel.dataset.resStatus, { status: sel.value });
        UI.toast(`Marked as "${sel.value}" ✓`, 'ok');
        renderFilters();
        renderResources();
      });
    });
  }

  /* ── Viewer overlay ────────────────────────── */
  function viewResource(id) {
    const r = Store.get('resources').find(x => x.id === id);
    if (!r) return;

    // For YouTube, open in new tab
    if (r.type === 'youtube' && r.url) { window.open(r.url, '_blank', 'noopener'); return; }

    // For URLs without local data, open in new tab
    if (!r.dataURL && r.url) { window.open(r.url, '_blank', 'noopener'); return; }

    // For PDF/files with dataURL, show inline viewer
    if (r.dataURL) {
      const overlay = document.getElementById('res2-viewer-overlay');
      const frame   = document.getElementById('res2-viewer-frame');
      const title   = document.getElementById('res2-viewer-title');
      if (!overlay || !frame) return;
      if (title) title.textContent = r.title;
      if (r.type === 'pdf' || r.fileName?.endsWith('.pdf')) {
        frame.src = r.dataURL;
      } else {
        // For images or other files
        frame.src = r.dataURL;
      }
      overlay.classList.remove('hidden');
    }
  }

  function closeViewer() {
    const overlay = document.getElementById('res2-viewer-overlay');
    const frame   = document.getElementById('res2-viewer-frame');
    if (overlay) overlay.classList.add('hidden');
    if (frame)   frame.src = '';
  }

  // Wire viewer close — called from index.html
  window.Pages.Resources._closeViewer = closeViewer;

  return { render, _closeViewer: closeViewer };
})();
