/* ═══════════════════════════════════════════════════
   pages/knowledge.js  — v4.0  [2025-prompt-4]
   Changes vs v3.1:
   - Edit topic name inline (pencil icon)
   - Global search across topics + subtopics
   - Drag-and-drop reorder subtopics (HTML5 drag API)
   - Pin subtopic to top (📌)
   - File upload input now uses consistent CSS classes
   - Knowledge replaces Java Q&A (java data still preserved in store)
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Knowledge = (() => {

  let activeTopicId = null;
  let activeSubId   = null;
  let editingSubId  = null;
  let editingTopicId = null;
  let searchQuery   = '';
  let pendingImages = [];
  let dragSrcIdx    = null;   // for drag-to-reorder

  /* ── Entry point ─────────────────────── */
  function render() {
    renderSearch();
    renderTopicSidebar();
    renderContent();

    const addBtn = document.getElementById('kn-add-topic-btn');
    if (addBtn && !addBtn._wired) {
      addBtn.addEventListener('click', addTopic);
      document.getElementById('kn-topic-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') addTopic();
      });
      addBtn._wired = true;
    }
  }

  /* ── Global search ───────────────────── */
  function renderSearch() {
    const searchEl = document.getElementById('kn-search');
    if (!searchEl) return;
    searchEl.value = searchQuery;
    if (!searchEl._wired) {
      searchEl.addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase();
        renderTopicSidebar();
        renderContent();
      });
      searchEl._wired = true;
    }
  }

  /* ── Topic sidebar ───────────────────── */
  function renderTopicSidebar() {
    const topics = Store.get('knowledge');
    const el     = document.getElementById('kn-topic-list');
    if (!el) return;

    const filtered = searchQuery
      ? topics.filter(t =>
          t.name.toLowerCase().includes(searchQuery) ||
          (t.subs||[]).some(s => s.title.toLowerCase().includes(searchQuery) || (s.notes||'').toLowerCase().includes(searchQuery))
        )
      : topics;

    if (!filtered.length) {
      el.innerHTML = `<div style="font-size:11px;font-family:var(--font-mono);color:var(--txt4);padding:.5rem">
        ${searchQuery ? 'No topics match your search.' : 'No topics yet. Create one above →'}
      </div>`;
      return;
    }

    el.innerHTML = filtered.map(t => `
      <div class="kn-topic-item ${t.id===activeTopicId?'active':''}" data-tid="${t.id}">
        ${editingTopicId === t.id
          ? `<input class="kn-topic-name-edit" id="kn-topic-rename-${t.id}" value="${UI.esc(t.name)}" style="flex:1;background:none;border:1px solid var(--accent);border-radius:4px;padding:2px 6px;color:var(--txt);font-family:var(--font-head);font-size:13px"/>`
          : `<span class="kn-topic-name">${UI.esc(t.name)}</span>`
        }
        <span class="kn-topic-count">${(t.subs||[]).length}</span>
        ${editingTopicId === t.id
          ? `<button class="iBtn" data-rename-confirm="${t.id}" style="color:var(--green);font-size:13px"><i class="ti ti-check"></i></button>
             <button class="iBtn" data-rename-cancel style="font-size:13px"><i class="ti ti-x"></i></button>`
          : `<button class="iBtn" data-rename-topic="${t.id}" style="font-size:13px;padding:2px 4px" title="Rename"><i class="ti ti-pencil"></i></button>
             <button class="iBtn" data-del-topic="${t.id}" style="font-size:13px;padding:2px 4px" title="Delete"><i class="ti ti-trash"></i></button>`
        }
      </div>`).join('');

    // Click to select topic
    el.querySelectorAll('.kn-topic-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('[data-del-topic],[data-rename-topic],[data-rename-confirm],[data-rename-cancel],.kn-topic-name-edit')) return;
        activeTopicId = item.dataset.tid;
        activeSubId   = null;
        editingTopicId = null;
        renderTopicSidebar();
        renderContent();
      });
    });

    // Rename
    el.querySelectorAll('[data-rename-topic]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); editingTopicId = btn.dataset.renameTopic; renderTopicSidebar(); setTimeout(()=>document.getElementById(`kn-topic-rename-${editingTopicId}`)?.focus(),50); });
    });
    el.querySelectorAll('[data-rename-confirm]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation();
        const inp = document.getElementById(`kn-topic-rename-${btn.dataset.renameConfirm}`);
        const newName = inp?.value.trim();
        if (!newName) { UI.toast('Name cannot be empty','err'); return; }
        const topic = Store.get('knowledge').find(t=>t.id===btn.dataset.renameConfirm);
        if (topic) { Store.upsert('knowledge', {...topic, name:newName}); }
        editingTopicId = null; renderTopicSidebar();
        UI.toast('Topic renamed ✓','ok');
      });
    });
    el.querySelectorAll('[data-rename-cancel]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); editingTopicId=null; renderTopicSidebar(); });
    });
    // Allow Enter in rename input
    el.querySelectorAll('.kn-topic-name-edit').forEach(inp => {
      inp.addEventListener('keydown', e => { if(e.key==='Enter') { inp.closest('[data-tid]')?.querySelector('[data-rename-confirm]')?.click(); } if(e.key==='Escape'){ editingTopicId=null; renderTopicSidebar(); } });
    });

    // Delete topic
    el.querySelectorAll('[data-del-topic]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation();
        if (!UI.confirm('Delete this topic and all its subtopics?')) return;
        Store.remove('knowledge', btn.dataset.delTopic);
        if (activeTopicId === btn.dataset.delTopic) { activeTopicId=null; activeSubId=null; }
        renderTopicSidebar(); renderContent();
      });
    });
  }

  function addTopic() {
    const name = document.getElementById('kn-topic-input')?.value.trim();
    if (!name) return;
    const t = { id:UI.uid(), name, subs:[], createdAt:new Date().toISOString() };
    Store.add('knowledge', t);
    activeTopicId = t.id;
    const inp = document.getElementById('kn-topic-input');
    if (inp) inp.value = '';
    renderTopicSidebar(); renderContent();
    UI.toast('Topic created ✓','ok');
  }

  /* ── Content area ─────────────────────── */
  function renderContent() {
    const el = document.getElementById('kn-content');
    if (!el) return;

    if (!activeTopicId) {
      if (searchQuery) {
        // Show global search results
        renderSearchResults(el);
        return;
      }
      el.innerHTML = `<div class="empty-state"><i class="ti ti-book"></i><p>Select or create a topic on the left</p></div>`;
      return;
    }

    const topics = Store.get('knowledge');
    const topic  = topics.find(t => t.id === activeTopicId);
    if (!topic) { el.innerHTML = ''; return; }

    let subs = topic.subs || [];

    // Filter subs by search
    if (searchQuery) {
      subs = subs.filter(s =>
        s.title.toLowerCase().includes(searchQuery) ||
        (s.notes||'').toLowerCase().includes(searchQuery) ||
        (s.links||[]).some(l => l.toLowerCase().includes(searchQuery))
      );
    }

    // Pinned first
    const pinned   = subs.filter(s => s.pinned);
    const unpinned = subs.filter(s => !s.pinned);
    const ordered  = [...pinned, ...unpinned];

    el.innerHTML = `
      <div class="kn-content-header">
        <div>
          <div class="page-title" style="font-size:18px">${UI.esc(topic.name)}</div>
          <div class="page-sub">${(topic.subs||[]).length} subtopic${(topic.subs||[]).length!==1?'s':''}${searchQuery?' (filtered)':''}</div>
        </div>
        <button class="btn btn-primary btn-sm" id="kn-add-sub-btn"><i class="ti ti-plus"></i> Add Subtopic</button>
      </div>

      <div id="kn-subs-list" style="display:flex;flex-direction:column;gap:8px">
        ${ordered.length
          ? ordered.map((s, idx) => subCardHTML(s, idx, ordered.length)).join('')
          : `<div class="empty-state" style="padding:2rem"><i class="ti ti-notes"></i><p>${searchQuery?'No subtopics match your search.':'No subtopics yet. Click "Add Subtopic" to start.'}</p></div>`
        }
      </div>

      <div id="kn-sub-form" class="form-card" style="margin-top:1.25rem;display:none">
        <div class="section-label" id="kn-sub-form-title">Add Subtopic</div>
        <div class="form-grid">
          <div class="fg full">
            <div class="flabel">Subtopic title *</div>
            <input type="text" id="kn-sub-title" placeholder="e.g. HashMap internals, Virtual Threads…"/>
          </div>
          <div class="fg full">
            <div class="flabel">Notes / explanation</div>
            <textarea id="kn-sub-notes" style="min-height:120px" placeholder="Write your notes here…"></textarea>
          </div>
          <div class="fg full">
            <div class="flabel">Reference links <span style="color:var(--txt4)">(one per line)</span></div>
            <textarea id="kn-sub-links" style="min-height:60px" placeholder="https://docs.oracle.com/…&#10;https://youtube.com/watch?v=…"></textarea>
          </div>
          <div class="fg full">
            <div class="flabel">Code snippet</div>
            <textarea id="kn-sub-code" style="min-height:80px;font-family:var(--font-mono);font-size:12px" placeholder="// paste code here"></textarea>
          </div>
          <div class="fg full">
            <div class="flabel">Images <span style="color:var(--txt4)">(PNG/JPG, multiple)</span></div>
            <label class="kn-file-upload-label">
              <input type="file" id="kn-sub-imgs" accept="image/*" multiple class="kn-file-input"/>
              <span class="kn-file-upload-text"><i class="ti ti-upload"></i> Click to select images</span>
            </label>
            <div id="kn-sub-img-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
          </div>
        </div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-sm" id="kn-sub-cancel-btn"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-primary" id="kn-sub-save-btn"><i class="ti ti-device-floppy"></i> Save Subtopic</button>
        </div>
      </div>`;

    // Wire form buttons
    document.getElementById('kn-add-sub-btn')?.addEventListener('click', () => openSubForm());
    document.getElementById('kn-sub-cancel-btn')?.addEventListener('click', closeSubForm);
    document.getElementById('kn-sub-save-btn')?.addEventListener('click', saveSub);
    document.getElementById('kn-sub-imgs')?.addEventListener('change', previewImages);

    wireSubCards(ordered);
  }

  function renderSearchResults(el) {
    const topics = Store.get('knowledge');
    const results = [];
    topics.forEach(t => {
      const matchingTopic = t.name.toLowerCase().includes(searchQuery);
      (t.subs||[]).forEach(s => {
        if (matchingTopic || s.title.toLowerCase().includes(searchQuery) || (s.notes||'').toLowerCase().includes(searchQuery)) {
          results.push({ topic: t, sub: s });
        }
      });
    });
    if (!results.length) { el.innerHTML = UI.emptyState('search', 'No results found'); return; }
    el.innerHTML = `<div class="section-label">Search results for "${UI.esc(searchQuery)}"</div>` +
      results.map(({topic,sub}) => `
        <div class="entry-card" style="margin-bottom:8px">
          <div style="padding:.75rem 1rem">
            <div style="font-size:10px;font-family:var(--font-mono);color:var(--txt3);margin-bottom:4px">${UI.esc(topic.name)}</div>
            <div class="entry-title">${UI.esc(sub.title)}</div>
            ${sub.notes ? `<div class="notes-block" style="margin-top:6px;font-size:12px">${UI.esc(sub.notes.substring(0,200))}${sub.notes.length>200?'…':''}</div>` : ''}
            <button class="btn btn-xs" style="margin-top:8px" onclick="(()=>{window.Pages.Knowledge._jump('${topic.id}','${sub.id}');})()">
              <i class="ti ti-arrow-right"></i> Go to subtopic
            </button>
          </div>
        </div>`).join('');
  }

  /* ── Subtopic card HTML ──────────────────── */
  function subCardHTML(s, idx, total) {
    const isOpen = activeSubId === s.id;
    const imgs   = s.images || [];
    const links  = s.links  || [];

    return `<div class="entry-card kn-sub-card ${isOpen?'open':''}" id="kn-sc-${s.id}"
               draggable="true" data-sub-idx="${idx}" style="margin-bottom:0">
      <div class="entry-top" data-kn-toggle="${s.id}" style="cursor:pointer">
        <div class="kn-drag-handle" title="Drag to reorder"><i class="ti ti-grip-vertical" style="color:var(--txt4);font-size:16px;cursor:grab"></i></div>
        ${s.pinned ? '<i class="ti ti-pin-filled" style="color:var(--amber);font-size:13px" title="Pinned"></i>' : ''}
        <i class="ti ti-chevron-right entry-chevron"></i>
        <div class="entry-main">
          <div class="entry-titlerow"><span class="entry-title">${UI.esc(s.title)}</span></div>
          <div class="entry-meta-row" style="margin-top:3px">
            ${links.length ? `<span><i class="ti ti-link"></i> ${links.length} link${links.length!==1?'s':''}</span>` : ''}
            ${imgs.length  ? `<span><i class="ti ti-photo"></i> ${imgs.length} image${imgs.length!==1?'s':''}</span>` : ''}
            ${s.code       ? `<span><i class="ti ti-code"></i> code</span>` : ''}
          </div>
        </div>
        <div class="entry-actions" onclick="event.stopPropagation()">
          <button class="iBtn" data-kn-pin="${s.id}" title="${s.pinned?'Unpin':'Pin to top'}" style="color:${s.pinned?'var(--amber)':'var(--txt4)'}"><i class="ti ti-pin"></i></button>
          <button class="iBtn" data-kn-edit="${s.id}" title="Edit"><i class="ti ti-edit"></i></button>
          <button class="iBtn del" data-kn-del="${s.id}" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${isOpen ? `<div class="entry-body" style="display:block"><div style="padding:1rem">
        ${s.notes ? `<div class="notes-block" style="margin-bottom:1rem">${UI.esc(s.notes)}</div>` : ''}
        ${s.code  ? `<div class="section-label" style="margin-bottom:6px">Code</div>
          <div class="code-display" style="margin-bottom:1rem"><button class="copy-btn" data-copy="${UI.esc(s.code)}">copy</button><code>${UI.esc(s.code)}</code></div>` : ''}
        ${links.length ? `<div class="section-label" style="margin-bottom:6px">Links</div>
          <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:1rem">
            ${links.map(l=>`<div class="link-display"><i class="ti ti-link" style="color:var(--txt3)"></i><a href="${UI.esc(l)}" target="_blank" rel="noopener">${UI.esc(l)}</a></div>`).join('')}
          </div>` : ''}
        ${imgs.length ? `<div class="section-label" style="margin-bottom:6px">Images</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${imgs.map(img=>`<img src="${img}" style="max-width:100%;max-height:300px;border-radius:var(--r);border:1px solid var(--line);cursor:pointer" onclick="window.Pages.Knowledge._viewImg('${img}')" alt="screenshot"/>`).join('')}
          </div>` : ''}
      </div></div>` : ''}
    </div>`;
  }

  /* ── Drag-to-reorder wiring ──────────────── */
  function wireSubCards(ordered) {
    const list = document.getElementById('kn-subs-list');
    if (!list) return;

    // Toggle open/close
    list.querySelectorAll('[data-kn-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubId = activeSubId===btn.dataset.knToggle ? null : btn.dataset.knToggle;
        renderContent();
      });
    });

    // Pin
    list.querySelectorAll('[data-kn-pin]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation();
        const topics = Store.get('knowledge');
        const topic  = topics.find(t=>t.id===activeTopicId); if(!topic) return;
        const sub    = (topic.subs||[]).find(s=>s.id===btn.dataset.knPin); if(!sub) return;
        sub.pinned   = !sub.pinned;
        Store.upsert('knowledge', topic);
        renderContent();
        UI.toast(sub.pinned ? 'Pinned ✓' : 'Unpinned', 'ok');
      });
    });

    // Edit / Delete
    list.querySelectorAll('[data-kn-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openSubForm(btn.dataset.knEdit); });
    });
    list.querySelectorAll('[data-kn-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation();
        if (!UI.confirm('Delete this subtopic?')) return;
        const topics = Store.get('knowledge');
        const topic  = topics.find(t=>t.id===activeTopicId); if(!topic) return;
        topic.subs   = (topic.subs||[]).filter(s=>s.id!==btn.dataset.knDel);
        Store.upsert('knowledge', topic);
        if (activeSubId===btn.dataset.knDel) activeSubId=null;
        renderContent();
      });
    });

    // Copy
    list.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); UI.copy(btn.dataset.copy); });
    });

    // Drag-to-reorder (HTML5 drag API)
    const cards = list.querySelectorAll('.kn-sub-card');
    cards.forEach((card, idx) => {
      card.addEventListener('dragstart', e => {
        dragSrcIdx = idx;
        card.style.opacity = '.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '';
        list.querySelectorAll('.kn-sub-card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.querySelectorAll('.kn-sub-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      });
      card.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrcIdx === null || dragSrcIdx === idx) return;
        const topics = Store.get('knowledge');
        const topic  = topics.find(t => t.id === activeTopicId); if (!topic) return;
        // Reorder against ordered (pinned first) array
        const subs   = [...(topic.subs||[])];
        const pinned   = subs.filter(s=>s.pinned);
        const unpinned = subs.filter(s=>!s.pinned);
        const reorder = [...pinned,...unpinned];
        const [moved] = reorder.splice(dragSrcIdx, 1);
        reorder.splice(idx, 0, moved);
        // Rebuild subs with new order, preserving items not in ordered
        topic.subs = reorder;
        Store.upsert('knowledge', topic);
        dragSrcIdx = null;
        renderContent();
      });
    });
  }

  /* ── Sub form ────────────────────────────── */
  function openSubForm(subId) {
    editingSubId  = subId || null;
    pendingImages = [];
    const form = document.getElementById('kn-sub-form'); if (!form) return;
    form.style.display = 'block';
    const formTitle = document.getElementById('kn-sub-form-title');
    if (formTitle) formTitle.textContent = subId ? 'Edit Subtopic' : 'Add Subtopic';
    const imgInp = document.getElementById('kn-sub-imgs'); if (imgInp) imgInp.value = '';
    const imgPrev = document.getElementById('kn-sub-img-preview'); if (imgPrev) imgPrev.innerHTML = '';

    if (subId) {
      const topics = Store.get('knowledge');
      const topic  = topics.find(t=>t.id===activeTopicId); if(!topic) return;
      const sub    = (topic.subs||[]).find(s=>s.id===subId); if(!sub) return;
      const set = (id,val)=>{const el=document.getElementById(id);if(el)el.value=val;};
      set('kn-sub-title', sub.title||'');
      set('kn-sub-notes', sub.notes||'');
      set('kn-sub-links', (sub.links||[]).join('\n'));
      set('kn-sub-code',  sub.code||'');
      pendingImages = [...(sub.images||[])];
      renderImgPreview();
    } else {
      ['kn-sub-title','kn-sub-notes','kn-sub-links','kn-sub-code'].forEach(id=>{
        const el=document.getElementById(id);if(el)el.value='';
      });
    }
    form.scrollIntoView({ behavior:'smooth' });
  }

  function closeSubForm() {
    editingSubId = null; pendingImages = [];
    const form = document.getElementById('kn-sub-form');
    if (form) form.style.display = 'none';
  }

  function previewImages() {
    const files = Array.from(document.getElementById('kn-sub-imgs')?.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => { pendingImages.push(e.target.result); renderImgPreview(); };
      reader.readAsDataURL(file);
    });
  }

  function renderImgPreview() {
    const el = document.getElementById('kn-sub-img-preview'); if (!el) return;
    el.innerHTML = pendingImages.map((src,i) => `
      <div style="position:relative">
        <img src="${src}" style="height:80px;border-radius:6px;border:1px solid var(--line);cursor:pointer" onclick="window.Pages.Knowledge._viewImg('${src}')"/>
        <button onclick="Pages.Knowledge._removeImg(${i})" style="position:absolute;top:-4px;right:-4px;background:var(--red);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center">×</button>
      </div>`).join('');
  }

  function saveSub() {
    const title = document.getElementById('kn-sub-title')?.value.trim();
    if (!title) { UI.toast('Enter a subtopic title','err'); return; }
    const topics = Store.get('knowledge');
    const topic  = topics.find(t=>t.id===activeTopicId); if(!topic) return;

    const existing = editingSubId ? (topic.subs||[]).find(s=>s.id===editingSubId) : null;
    const sub = {
      id:        editingSubId || UI.uid(),
      title,
      notes:     document.getElementById('kn-sub-notes')?.value.trim() || '',
      links:     (document.getElementById('kn-sub-links')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean),
      code:      document.getElementById('kn-sub-code')?.value.trim()  || '',
      images:    [...pendingImages],
      pinned:    existing?.pinned || false,
      updatedAt: new Date().toISOString(),
    };

    if (!topic.subs) topic.subs = [];
    const idx = topic.subs.findIndex(s=>s.id===sub.id);
    if (idx>=0) topic.subs[idx]=sub; else topic.subs.push(sub);

    Store.upsert('knowledge', topic);
    closeSubForm();
    activeSubId = sub.id;
    renderTopicSidebar(); renderContent();
    UI.toast('Subtopic saved ✓','ok');
  }

  /* ── Image viewer overlay ────────────────── */
  function viewImg(src) {
    const overlay = document.getElementById('kn-img-viewer');
    if (!overlay) {
      const div = document.createElement('div');
      div.id = 'kn-img-viewer';
      div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:600;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      div.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain"/>`;
      div.addEventListener('click', () => div.remove());
      document.body.appendChild(div);
    } else {
      overlay.querySelector('img').src = src;
    }
  }

  /* ── Navigate to specific sub ────────────── */
  function jump(topicId, subId) {
    activeTopicId = topicId;
    activeSubId   = subId;
    searchQuery   = '';
    renderTopicSidebar(); renderContent();
  }

  return {
    render,
    _removeImg: (i) => { pendingImages.splice(i,1); renderImgPreview(); },
    _viewImg:   (src) => viewImg(src),
    _jump:      (tid, sid) => jump(tid, sid),
  };
})();