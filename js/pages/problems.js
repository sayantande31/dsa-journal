/* ═══════════════════════════════════
   pages/problems.js
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Problems = (() => {
  let filterCat  = 'All';
  let filterDiff = 'All';
  let tagMgr, codeEditor;
  let editingId  = null;

  // ── Form init ──────────────────────────────────────────
  function initForm() {
    document.getElementById('f-date').value = UI.today();

    tagMgr = UI.TagManager(
      document.getElementById('f-tags'),
      document.getElementById('f-tag-presets')
    );

    const cedWrap = document.getElementById('f-code-editor');
    cedWrap.id = 'ced-problems'; // stable ID
    codeEditor = UI.CodeEditor(cedWrap);

    document.getElementById('prob-save-btn').addEventListener('click', saveEntry);
    document.getElementById('prob-clear-btn').addEventListener('click', clearForm);
  }

  function clearForm() {
    editingId = null;
    document.getElementById('f-title').value  = '';
    document.getElementById('f-notes').value  = '';
    document.getElementById('f-link').value   = '';
    document.getElementById('f-cat').value    = 'DSA';
    document.getElementById('f-diff').value   = 'Medium';
    document.getElementById('f-status').value = 'Solved';
    document.getElementById('f-date').value   = UI.today();
    tagMgr && tagMgr.reset();
    codeEditor && codeEditor.reset();
    document.getElementById('prob-save-btn').textContent = '💾 Save & Sync';
    document.getElementById('form-section-title').textContent = 'Log Problem';
  }

  async function saveEntry() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { UI.toast('Please enter a title', 'err'); return; }

    const entry = {
      id:         editingId || UI.uid(),
      title,
      category:   document.getElementById('f-cat').value,
      difficulty: document.getElementById('f-diff').value,
      status:     document.getElementById('f-status').value,
      date:       document.getElementById('f-date').value || UI.today(),
      link:       document.getElementById('f-link').value.trim(),
      notes:      document.getElementById('f-notes').value.trim(),
      codeTabs:   codeEditor.getTabs(),
      tags:       tagMgr.getTags(),
      flagged:    false,
    };

    if (editingId) {
      const existing = Store.get('problems').find(p => p.id === editingId);
      entry.flagged = existing ? existing.flagged : false;
      Store.upsert('problems', entry);
      UI.toast('Problem updated ✓', 'ok');
    } else {
      Store.add('problems', entry);
      UI.toast('Problem saved & syncing ✓', 'ok');
    }

    clearForm();
    renderList();
    Router.refreshBadges();
  }

  function editEntry(id) {
    const e = Store.get('problems').find(p => p.id === id);
    if (!e) return;
    editingId = id;
    document.getElementById('f-title').value  = e.title;
    document.getElementById('f-cat').value    = e.category;
    document.getElementById('f-diff').value   = e.difficulty;
    document.getElementById('f-status').value = e.status || 'Solved';
    document.getElementById('f-date').value   = e.date || UI.today();
    document.getElementById('f-link').value   = e.link || '';
    document.getElementById('f-notes').value  = e.notes || '';
    tagMgr.set(e.tags || []);
    codeEditor.setTabs(e.codeTabs && e.codeTabs.length ? e.codeTabs : [
      { id: 'brute',   label: 'Brute Force', code: '', complexity: '' },
      { id: 'optimal', label: 'Optimal',     code: '', complexity: '' },
    ]);
    document.getElementById('prob-save-btn').textContent = '✏️ Update Problem';
    document.getElementById('form-section-title').textContent = 'Edit Problem';
    document.getElementById('prob-form-anchor').scrollIntoView({ behavior: 'smooth' });
  }

  async function deleteEntry(id) {
    if (!UI.confirm('Delete this problem?')) return;
    Store.remove('problems', id);
    UI.openCards.delete(id);
    renderList();
    UI.toast('Deleted', 'warn');
    Router.refreshBadges();
  }

  function toggleFlag(id) {
    const p = Store.get('problems').find(x => x.id === id);
    if (p) { Store.update('problems', id, { flagged: !p.flagged }); renderList(); Router.refreshBadges(); }
  }

  // ── Filters ────────────────────────────────────────────
  function setFilterCat(val, el) {
    filterCat = val;
    document.querySelectorAll('#cat-filters .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderList();
  }

  function setFilterDiff(val, el) {
    filterDiff = val;
    document.querySelectorAll('#diff-filters .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderList();
  }

  function getFiltered() {
    const q    = (document.getElementById('prob-search').value || '').toLowerCase();
    const from = (document.getElementById('prob-from').value || '');
    const to   = (document.getElementById('prob-to').value   || '');
    return Store.get('problems').filter(e => {
      const mCat  = filterCat  === 'All' || e.category  === filterCat;
      const mDiff = filterDiff === 'All' || e.difficulty === filterDiff;
      const mDate = (!from || e.date >= from) && (!to || e.date <= to);
      const mQ    = !q || e.title.toLowerCase().includes(q)
                      || (e.notes||'').toLowerCase().includes(q)
                      || (e.tags||[]).some(t => t.toLowerCase().includes(q))
                      || (e.codeTabs||[]).some(t => (t.code||'').toLowerCase().includes(q));
      return mCat && mDiff && mDate && mQ;
    });
  }

  // ── List render ────────────────────────────────────────
  function renderList() {
    const list = getFiltered();
    const el   = document.getElementById('prob-list');
    document.getElementById('prob-count-label').textContent = `${list.length} problem${list.length !== 1 ? 's' : ''}`;

    if (!list.length) {
      el.innerHTML = UI.emptyState('notes', 'No problems match your filters');
      return;
    }
    el.innerHTML = `<div class="entries-list">${list.map(e => UI.entryCardHTML(e, actions(e))).join('')}</div>`;
    wireList(el);
  }

  function actions(e) {
    return `
      ${e.link ? `<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn" title="Open link"><i class="ti ti-external-link"></i></a>` : ''}
      <button class="iBtn ${e.flagged ? 'star-on' : ''}" data-flag="${e.id}" title="Revision queue"><i class="ti ti-star"></i></button>
      <button class="iBtn" data-edit="${e.id}" title="Edit"><i class="ti ti-edit"></i></button>
      <button class="iBtn del" data-del="${e.id}" title="Delete"><i class="ti ti-trash"></i></button>`;
  }

  function wireList(container) {
    container.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => { UI.toggleCard(btn.dataset.toggle); renderList(); });
    });
    container.querySelectorAll('.ebtab').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); UI.setCardBodyTab(btn.dataset.card, btn.dataset.tab); renderList(); });
    });
    container.querySelectorAll('[data-flag]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleFlag(btn.dataset.flag); });
    });
    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); editEntry(btn.dataset.edit); });
    });
    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deleteEntry(btn.dataset.del); });
    });
    container.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); UI.copy(btn.dataset.copy); });
    });
  }

  // ── Page render ────────────────────────────────────────
  function render() {
    renderList();
    // Init form on first render only
    if (!document.getElementById('prob-save-btn')._wired) {
      initForm();
      document.getElementById('prob-save-btn')._wired = true;
      // wire filter chips
      document.querySelectorAll('#cat-filters .chip').forEach(el => {
        el.addEventListener('click', () => setFilterCat(el.dataset.val, el));
      });
      document.querySelectorAll('#diff-filters .chip').forEach(el => {
        el.addEventListener('click', () => setFilterDiff(el.dataset.val, el));
      });
      document.getElementById('prob-search').addEventListener('input', renderList);
      document.getElementById('prob-from').addEventListener('change', renderList);
      document.getElementById('prob-to').addEventListener('change', renderList);
      document.getElementById('prob-clear-dates').addEventListener('click', () => {
        document.getElementById('prob-from').value = '';
        document.getElementById('prob-to').value   = '';
        renderList();
      });
    }
  }

  return { render, editEntry, deleteEntry, toggleFlag };
})();
