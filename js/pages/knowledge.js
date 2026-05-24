/* ═══════════════════════════════════
   pages/knowledge.js  v1
   Dynamic topic → subtopic knowledge base
   Each topic can have multiple subtopics
   Each subtopic has: text, links, images (base64), code
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Knowledge = (() => {

  let activeTopicId    = null;
  let activeSubId      = null;
  let editingTopicId   = null;
  let editingSubId     = null;
  let wired            = false;

  /* ── Render entry point ─────────────────── */
  function render() {
    renderTopicSidebar();
    renderContent();
    if (!wired) {
      document.getElementById('kn-add-topic-btn').addEventListener('click', addTopic);
      document.getElementById('kn-topic-input').addEventListener('keydown', e=>{ if(e.key==='Enter') addTopic(); });
      wired = true;
    }
  }

  /* ── Topic sidebar ───────────────────────── */
  function renderTopicSidebar() {
    const topics = Store.get('knowledge');
    const el = document.getElementById('kn-topic-list');
    if (!topics.length) {
      el.innerHTML = `<div style="font-size:11px;font-family:var(--font-mono);color:var(--txt4);padding:.5rem">No topics yet. Create one →</div>`;
      return;
    }
    el.innerHTML = topics.map(t => `
      <div class="kn-topic-item ${t.id===activeTopicId?'active':''}" data-tid="${t.id}">
        <span class="kn-topic-name">${UI.esc(t.name)}</span>
        <span class="kn-topic-count">${(t.subs||[]).length}</span>
        <button class="iBtn" data-del-topic="${t.id}" style="font-size:13px;padding:2px 4px" title="Delete topic"><i class="ti ti-trash"></i></button>
      </div>`).join('');

    el.querySelectorAll('.kn-topic-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('[data-del-topic]')) return;
        activeTopicId = item.dataset.tid;
        activeSubId   = null;
        editingSubId  = null;
        renderTopicSidebar();
        renderContent();
      });
    });
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
    const name = document.getElementById('kn-topic-input').value.trim();
    if (!name) return;
    const t = { id:UI.uid(), name, subs:[], createdAt:new Date().toISOString() };
    Store.add('knowledge', t);
    activeTopicId = t.id;
    document.getElementById('kn-topic-input').value='';
    renderTopicSidebar(); renderContent();
    UI.toast('Topic created ✓','ok');
  }

  /* ── Main content area ───────────────────── */
  function renderContent() {
    const el = document.getElementById('kn-content');
    if (!activeTopicId) {
      el.innerHTML = `<div class="empty-state"><i class="ti ti-book"></i><p>Select or create a topic on the left</p></div>`;
      return;
    }
    const topics = Store.get('knowledge');
    const topic  = topics.find(t=>t.id===activeTopicId);
    if (!topic) { el.innerHTML=''; return; }

    const subs = topic.subs || [];
    el.innerHTML = `
      <div class="kn-content-header">
        <div>
          <div class="page-title" style="font-size:18px">${UI.esc(topic.name)}</div>
          <div class="page-sub">${subs.length} subtopic${subs.length!==1?'s':''}</div>
        </div>
        <button class="btn btn-primary btn-sm" id="kn-add-sub-btn"><i class="ti ti-plus"></i> Add Subtopic</button>
      </div>

      <!-- Subtopic list -->
      <div id="kn-subs-list">
        ${subs.length ? subs.map(s => subCardHTML(s)).join('') : `<div class="empty-state" style="padding:2rem"><i class="ti ti-notes"></i><p>No subtopics yet. Click "Add Subtopic" to start.</p></div>`}
      </div>

      <!-- Add/edit subtopic form -->
      <div id="kn-sub-form" class="form-card" style="margin-top:1.25rem;display:none">
        <div class="section-label" id="kn-sub-form-title">Add Subtopic</div>
        <div class="form-grid">
          <div class="fg full">
            <div class="flabel">Subtopic title *</div>
            <input type="text" id="kn-sub-title" placeholder="e.g. HashMap internals, Virtual Threads, …"/>
          </div>
          <div class="fg full">
            <div class="flabel">Notes / explanation (supports markdown-style text)</div>
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
            <div class="flabel">Images <span style="color:var(--txt4)">(PNG/JPG, multiple allowed)</span></div>
            <input type="file" id="kn-sub-imgs" accept="image/*" multiple style="font-size:12px"/>
            <div id="kn-sub-img-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"></div>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" id="kn-sub-cancel-btn"><i class="ti ti-x"></i> Cancel</button>
          <button class="btn btn-primary" id="kn-sub-save-btn"><i class="ti ti-device-floppy"></i> Save Subtopic</button>
        </div>
      </div>`;

    document.getElementById('kn-add-sub-btn').addEventListener('click', () => openSubForm());
    document.getElementById('kn-sub-cancel-btn').addEventListener('click', closeSubForm);
    document.getElementById('kn-sub-save-btn').addEventListener('click', saveSub);
    document.getElementById('kn-sub-imgs').addEventListener('change', previewImages);

    wireSubCards();
  }

  /* ── Subtopic card HTML ──────────────────── */
  function subCardHTML(s) {
    const isOpen = activeSubId === s.id;
    const imgs = s.images||[];
    const links = (s.links||[]);
    return `<div class="entry-card ${isOpen?'open':''}" id="kn-sc-${s.id}" style="margin-bottom:8px">
      <div class="entry-top" data-kn-toggle="${s.id}">
        <i class="ti ti-chevron-right entry-chevron"></i>
        <div class="entry-main">
          <div class="entry-titlerow"><span class="entry-title">${UI.esc(s.title)}</span></div>
          <div class="entry-meta-row" style="margin-top:3px">
            ${links.length?`<span><i class="ti ti-link"></i> ${links.length} link${links.length!==1?'s':''}</span>`:''}
            ${imgs.length?`<span><i class="ti ti-photo"></i> ${imgs.length} image${imgs.length!==1?'s':''}</span>`:''}
            ${s.code?`<span><i class="ti ti-code"></i> code</span>`:''}
          </div>
        </div>
        <div class="entry-actions" onclick="event.stopPropagation()">
          <button class="iBtn" data-kn-edit="${s.id}" title="Edit"><i class="ti ti-edit"></i></button>
          <button class="iBtn del" data-kn-del="${s.id}" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </div>
      ${isOpen ? `<div class="entry-body" style="display:block">
        <div style="padding:1rem">
          ${s.notes?`<div class="notes-block" style="margin-bottom:1rem">${UI.esc(s.notes)}</div>`:''}
          ${s.code?`<div class="section-label" style="margin-bottom:6px">Code</div>
            <div class="code-display" style="margin-bottom:1rem"><button class="copy-btn" data-copy="${UI.esc(s.code)}">copy</button><code>${UI.esc(s.code)}</code></div>`:''}
          ${links.length?`<div class="section-label" style="margin-bottom:6px">Links</div>
            <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:1rem">
              ${links.map(l=>`<div class="link-display"><i class="ti ti-link" style="color:var(--txt3)"></i><a href="${UI.esc(l)}" target="_blank" rel="noopener">${UI.esc(l)}</a></div>`).join('')}
            </div>`:''}
          ${imgs.length?`<div class="section-label" style="margin-bottom:6px">Images</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${imgs.map(img=>`<img src="${img}" style="max-width:100%;max-height:300px;border-radius:var(--r);border:1px solid var(--line)" alt="screenshot"/>`).join('')}
            </div>`:''}
        </div>
      </div>` : ''}
    </div>`;
  }

  function wireSubCards() {
    const list = document.getElementById('kn-subs-list'); if (!list) return;
    list.querySelectorAll('[data-kn-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeSubId = activeSubId===btn.dataset.knToggle ? null : btn.dataset.knToggle;
        renderContent();
      });
    });
    list.querySelectorAll('[data-kn-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openSubForm(btn.dataset.knEdit); });
    });
    list.querySelectorAll('[data-kn-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation();
        if (!UI.confirm('Delete this subtopic?')) return;
        const topics = Store.get('knowledge');
        const topic  = topics.find(t=>t.id===activeTopicId); if (!topic) return;
        topic.subs   = (topic.subs||[]).filter(s=>s.id!==btn.dataset.knDel);
        Store.upsert('knowledge', topic);
        if (activeSubId===btn.dataset.knDel) activeSubId=null;
        renderContent();
      });
    });
    list.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',e=>{e.stopPropagation();UI.copy(btn.dataset.copy);});
    });
  }

  /* ── Sub form ────────────────────────────── */
  let pendingImages = []; // base64 strings of newly uploaded images

  function openSubForm(subId) {
    editingSubId = subId || null;
    pendingImages = [];
    const form = document.getElementById('kn-sub-form'); if (!form) return;
    form.style.display = 'block';
    document.getElementById('kn-sub-form-title').textContent = subId ? 'Edit Subtopic' : 'Add Subtopic';
    document.getElementById('kn-sub-imgs').value = '';
    document.getElementById('kn-sub-img-preview').innerHTML = '';

    if (subId) {
      const topics = Store.get('knowledge');
      const topic  = topics.find(t=>t.id===activeTopicId); if (!topic) return;
      const sub    = (topic.subs||[]).find(s=>s.id===subId); if (!sub) return;
      document.getElementById('kn-sub-title').value = sub.title||'';
      document.getElementById('kn-sub-notes').value = sub.notes||'';
      document.getElementById('kn-sub-links').value = (sub.links||[]).join('\n');
      document.getElementById('kn-sub-code').value  = sub.code||'';
      // show existing images
      pendingImages = [...(sub.images||[])];
      renderImgPreview();
    } else {
      document.getElementById('kn-sub-title').value='';
      document.getElementById('kn-sub-notes').value='';
      document.getElementById('kn-sub-links').value='';
      document.getElementById('kn-sub-code').value='';
    }
    form.scrollIntoView({behavior:'smooth'});
  }

  function closeSubForm() {
    editingSubId=null; pendingImages=[];
    const form=document.getElementById('kn-sub-form'); if(form) form.style.display='none';
  }

  function previewImages() {
    const files = Array.from(document.getElementById('kn-sub-imgs').files);
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
        <img src="${src}" style="height:80px;border-radius:6px;border:1px solid var(--line)"/>
        <button onclick="Pages.Knowledge._removeImg(${i})" style="position:absolute;top:-4px;right:-4px;background:var(--red);border:none;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;line-height:1">×</button>
      </div>`).join('');
  }

  function saveSub() {
    const title = document.getElementById('kn-sub-title').value.trim();
    if (!title) { UI.toast('Enter a subtopic title','err'); return; }
    const topics = Store.get('knowledge');
    const topic  = topics.find(t=>t.id===activeTopicId); if (!topic) return;

    const sub = {
      id:     editingSubId || UI.uid(),
      title,
      notes:  document.getElementById('kn-sub-notes').value.trim(),
      links:  document.getElementById('kn-sub-links').value.split('\n').map(l=>l.trim()).filter(Boolean),
      code:   document.getElementById('kn-sub-code').value.trim(),
      images: [...pendingImages],
      updatedAt: new Date().toISOString(),
    };

    if (!topic.subs) topic.subs=[];
    const idx = topic.subs.findIndex(s=>s.id===sub.id);
    if (idx>=0) topic.subs[idx]=sub; else topic.subs.push(sub);

    Store.upsert('knowledge', topic);
    closeSubForm();
    activeSubId = sub.id;
    renderTopicSidebar(); renderContent();
    UI.toast('Subtopic saved ✓','ok');
  }

  return {
    render,
    _removeImg: (i) => { pendingImages.splice(i,1); renderImgPreview(); },
  };
})();
