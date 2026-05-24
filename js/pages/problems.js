/* ═══════════════════════════════════════════════════
   pages/problems.js  — v3.1  [FIXED: 2025-prompt-3]
   Fixes:
   - LogForm.init() no longer uses a permanent `wired` guard.
     Instead it checks if elements are already wired via a flag on the DOM
     element itself (_wired), so navigating away and back re-inits correctly.
   - CodeEditor and TagManager are re-created only when the DOM element
     is not yet wired, preventing double-binding.
   - clear() safely resets without crashing if called before init.
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};

/* ── Log Form (page-log) ───────────────────────────── */
window.Pages.LogForm = (() => {
  let tagMgr     = null;
  let codeEditor = null;
  let editingId  = null;

  function init() {
    // Use DOM element flag to prevent double-wiring on repeated render() calls
    const saveBtn = document.getElementById('prob-save-btn');
    if (!saveBtn || saveBtn._wired) return;

    // Set defaults
    const fdate = document.getElementById('f-date');
    if (fdate) fdate.value = UI.today();

    // Tag manager
    const tagsEl    = document.getElementById('f-tags');
    const presetsEl = document.getElementById('f-tag-presets');
    if (tagsEl && presetsEl) {
      tagMgr = UI.TagManager(tagsEl, presetsEl);
    }

    // Code editor
    const cedWrap = document.getElementById('f-code-editor');
    if (cedWrap) {
      cedWrap.id = 'ced-problems'; // stable ID for CodeEditor internals
      codeEditor  = UI.CodeEditor(cedWrap);
    }

    // Buttons
    saveBtn.addEventListener('click', save);
    saveBtn._wired = true;

    const clearBtn = document.getElementById('prob-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clear);
  }

  function clear() {
    editingId = null;

    // Text inputs / textareas
    ['f-title', 'f-notes', 'f-link', 'f-yt-links'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // Selects
    const fc = document.getElementById('f-cat');    if (fc) fc.value = 'DSA';
    const fd = document.getElementById('f-diff');   if (fd) fd.value = 'Medium';
    const fs = document.getElementById('f-status'); if (fs) fs.value = 'Solved';
    const fdt= document.getElementById('f-date');   if (fdt) fdt.value = UI.today();

    // Tag manager & code editor — only if they exist
    tagMgr?.reset();
    codeEditor?.reset();

    // Reset button label
    const btn = document.getElementById('prob-save-btn');
    if (btn) btn.innerHTML = '<i class="ti ti-device-floppy"></i> Save &amp; Sync';

    const tit = document.getElementById('form-section-title');
    if (tit) tit.textContent = 'Log Problem';
  }

  async function save() {
    const titleEl = document.getElementById('f-title');
    const title   = titleEl ? titleEl.value.trim() : '';
    if (!title) { UI.toast('Please enter a title', 'err'); return; }

    // Parse YouTube / extra links
    const ytRaw   = document.getElementById('f-yt-links')?.value || '';
    const ytLinks = ytRaw.trim()
      ? ytRaw.split('\n').map(l => l.trim()).filter(Boolean)
      : [];

    const entry = {
      id:         editingId || UI.uid(),
      title,
      category:   document.getElementById('f-cat')?.value    || 'DSA',
      difficulty: document.getElementById('f-diff')?.value   || 'Medium',
      status:     document.getElementById('f-status')?.value || 'Solved',
      date:       document.getElementById('f-date')?.value   || UI.today(),
      link:       document.getElementById('f-link')?.value.trim() || '',
      ytLinks,
      notes:      document.getElementById('f-notes')?.value.trim() || '',
      codeTabs:   codeEditor ? codeEditor.getTabs() : [],
      tags:       tagMgr    ? tagMgr.getTags()      : [],
      flagged:    false,
    };

    if (editingId) {
      const existing = Store.get('problems').find(p => p.id === editingId);
      entry.flagged  = existing?.flagged  || false;
      entry.fromTodo = existing?.fromTodo || null;
      Store.upsert('problems', entry);
      UI.toast('Problem updated ✓', 'ok');
    } else {
      Store.add('problems', entry);
      UI.toast('Saved & syncing ✓', 'ok');
    }

    clear();
    Router.goto('problems');
  }

  function loadForEdit(id) {
    const e = Store.get('problems').find(p => p.id === id);
    if (!e) return;

    // Make sure form is initialised before we try to populate it
    render();

    editingId = id;
    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val; };
    set('f-title',    e.title);
    set('f-cat',      e.category);
    set('f-diff',     e.difficulty);
    set('f-status',   e.status   || 'Solved');
    set('f-date',     e.date     || UI.today());
    set('f-link',     e.link     || '');
    set('f-notes',    e.notes    || '');
    set('f-yt-links', (e.ytLinks || []).join('\n'));

    tagMgr?.set(e.tags || []);

    const defaultTabs = [
      { id: 'brute',   label: 'Brute Force', code: '', complexity: '' },
      { id: 'optimal', label: 'Optimal',     code: '', complexity: '' },
    ];
    codeEditor?.setTabs(e.codeTabs?.length ? e.codeTabs : defaultTabs);

    const btn = document.getElementById('prob-save-btn');
    if (btn) btn.innerHTML = '<i class="ti ti-edit"></i> Update Problem';

    const tit = document.getElementById('form-section-title');
    if (tit) tit.textContent = 'Edit Problem';

    Router.goto('log');
    setTimeout(() => document.getElementById('f-title')?.focus(), 120);
  }

  // Called by Router every time user navigates to 'log'
  function render() {
    init(); // safe to call repeatedly — idempotent after first wire
  }

  return { render, clear, loadForEdit };
})();

/* ── Problems list (page-problems) ─────────────────── */
window.Pages.Problems = (() => {
  let filterCat  = 'All';
  let filterDiff = 'All';
  let wired      = false;

  function render() {
    renderList();
    if (!wired) {
      // Category chips
      document.querySelectorAll('#cat-filters .chip').forEach(el => {
        el.addEventListener('click', () => {
          filterCat = el.dataset.val;
          document.querySelectorAll('#cat-filters .chip').forEach(c => c.classList.remove('active'));
          el.classList.add('active');
          renderList();
        });
      });

      // Difficulty chips
      document.querySelectorAll('#diff-filters .chip').forEach(el => {
        el.addEventListener('click', () => {
          filterDiff = el.dataset.val;
          document.querySelectorAll('#diff-filters .chip').forEach(c => c.classList.remove('active'));
          el.classList.add('active');
          renderList();
        });
      });

      // Search + date filters
      document.getElementById('prob-search')?.addEventListener('input', renderList);
      document.getElementById('prob-from')?.addEventListener('change', renderList);
      document.getElementById('prob-to')?.addEventListener('change', renderList);

      document.getElementById('prob-today-btn')?.addEventListener('click', () => {
        const t = UI.today();
        const f = document.getElementById('prob-from');
        const to = document.getElementById('prob-to');
        if (f)  f.value  = t;
        if (to) to.value = t;
        renderList();
      });

      document.getElementById('prob-clear-dates')?.addEventListener('click', () => {
        const f = document.getElementById('prob-from');
        const t = document.getElementById('prob-to');
        if (f) f.value = '';
        if (t) t.value = '';
        renderList();
      });

      wired = true;
    }
  }

  function getFiltered() {
    const q    = (document.getElementById('prob-search')?.value || '').toLowerCase();
    const from =  document.getElementById('prob-from')?.value   || '';
    const to   =  document.getElementById('prob-to')?.value     || '';

    return Store.get('problems').filter(e => {
      const mCat  = filterCat  === 'All' || e.category  === filterCat;
      const mDiff = filterDiff === 'All' || e.difficulty === filterDiff;
      const mDate = (!from || e.date >= from) && (!to || e.date <= to);
      const mQ    = !q
        || e.title.toLowerCase().includes(q)
        || (e.notes  || '').toLowerCase().includes(q)
        || (e.tags   || []).some(t => t.toLowerCase().includes(q))
        || (e.codeTabs || []).some(t => (t.code || '').toLowerCase().includes(q));
      return mCat && mDiff && mDate && mQ;
    });
  }

  function renderList() {
    const list = getFiltered();
    const countEl = document.getElementById('prob-count-label');
    if (countEl) countEl.textContent = `${list.length} problem${list.length !== 1 ? 's' : ''}`;

    const el = document.getElementById('prob-list');
    if (!el) return;

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
      btn.addEventListener('click', () => {
        UI.toggleCard(btn.dataset.toggle);
        renderList();
      });
    });

    container.querySelectorAll('.ebtab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        UI.setCardBodyTab(btn.dataset.card, btn.dataset.tab);
        renderList();
      });
    });

    container.querySelectorAll('[data-flag]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = Store.get('problems').find(x => x.id === btn.dataset.flag);
        if (p) {
          Store.update('problems', p.id, { flagged: !p.flagged });
          renderList();
          Router.refreshBadges();
        }
      });
    });

    container.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Pages.LogForm.loadForEdit(btn.dataset.edit);
      });
    });

    container.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!UI.confirm('Delete this problem?')) return;
        Store.remove('problems', btn.dataset.del);
        UI.openCards.delete(btn.dataset.del);
        renderList();
        Router.refreshBadges();
        UI.toast('Deleted', 'warn');
      });
    });

    container.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        UI.copy(btn.dataset.copy);
      });
    });
  }

  return { render };
})();
