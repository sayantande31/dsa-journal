/* ═══════════════════════════════════════════════════
   pages/planner.js — v4.0 [2025-prompt-4]
   Daily Planner features:
   - Pick a date, add free-text notes for the day
   - Add time-block entries (time + task + category + done tick)
   - Navigate day by day (prev/next arrows)
   - Today button to jump to current date
   - Week overview strip
   - All data persisted via Store → Gist
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Planner = (() => {
  let activeDate = UI.today();

  /* ── Entry point ─────────────────────────────── */
  function render() {
    renderDateNav();
    renderWeekStrip();
    renderDayView();
    wireNav();
  }

  /* ── Date navigation ─────────────────────────── */
  function renderDateNav() {
    const el = document.getElementById('pl-date-display');
    if (el) el.textContent = new Date(activeDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const inp = document.getElementById('pl-date-picker');
    if (inp) inp.value = activeDate;
  }

  function wireNav() {
    const prevBtn = document.getElementById('pl-prev-btn');
    const nextBtn = document.getElementById('pl-next-btn');
    const todayBtn= document.getElementById('pl-today-btn');
    const picker  = document.getElementById('pl-date-picker');

    if (prevBtn && !prevBtn._wired) {
      prevBtn.addEventListener('click', () => { activeDate = offsetDate(activeDate, -1); render(); });
      prevBtn._wired = true;
    }
    if (nextBtn && !nextBtn._wired) {
      nextBtn.addEventListener('click', () => { activeDate = offsetDate(activeDate,  1); render(); });
      nextBtn._wired = true;
    }
    if (todayBtn && !todayBtn._wired) {
      todayBtn.addEventListener('click', () => { activeDate = UI.today(); render(); });
      todayBtn._wired = true;
    }
    if (picker && !picker._wired) {
      picker.addEventListener('change', () => { if (picker.value) { activeDate = picker.value; render(); } });
      picker._wired = true;
    }
  }

  function offsetDate(iso, days) {
    const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  /* ── Week strip ──────────────────────────────── */
  function renderWeekStrip() {
    const el = document.getElementById('pl-week-strip'); if (!el) return;
    const planner = Store.get('planner');
    const today   = UI.today();
    // Show 7 days centred on active date
    const days = [];
    for (let i = -3; i <= 3; i++) days.push(offsetDate(activeDate, i));
    el.innerHTML = days.map(d => {
      const hasEntries = planner.some(e => e.date === d);
      const isToday    = d === today;
      const isActive   = d === activeDate;
      const dt         = new Date(d + 'T00:00:00');
      const dayName    = dt.toLocaleDateString('en-GB', { weekday:'short' });
      const dayNum     = dt.getDate();
      return `<button class="pl-week-day ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}" data-pl-date="${d}">
        <span class="pl-week-day-name">${dayName}</span>
        <span class="pl-week-day-num">${dayNum}</span>
        ${hasEntries ? '<span class="pl-week-dot"></span>' : ''}
      </button>`;
    }).join('');
    el.querySelectorAll('[data-pl-date]').forEach(btn => {
      btn.addEventListener('click', () => { activeDate = btn.dataset.plDate; render(); });
    });
  }

  /* ── Day view ────────────────────────────────── */
  function renderDayView() {
    const planner = Store.get('planner');
    const dayEntry = planner.find(e => e.date === activeDate) || { date: activeDate, notes: '', blocks: [] };

    const el = document.getElementById('pl-day-content'); if (!el) return;
    const blocks = dayEntry.blocks || [];
    const sorted = [...blocks].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    el.innerHTML = `
      <!-- Day notes -->
      <div class="pl-section">
        <div class="pl-section-label"><i class="ti ti-notes"></i> Day notes / free text</div>
        <textarea id="pl-day-notes" class="pl-notes-area" placeholder="Brain dump, goals for today, reflections, anything…">${UI.esc(dayEntry.notes || '')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:6px">
          <button class="btn btn-sm btn-primary" id="pl-save-notes-btn"><i class="ti ti-device-floppy"></i> Save notes</button>
        </div>
      </div>

      <!-- Time blocks -->
      <div class="pl-section">
        <div class="pl-section-label"><i class="ti ti-clock"></i> Time blocks</div>
        <div id="pl-blocks-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          ${sorted.length ? sorted.map(b => blockHTML(b)).join('') : `<div style="font-size:12px;font-family:var(--font-mono);color:var(--txt3);padding:.5rem 0">No time blocks yet. Add one below.</div>`}
        </div>

        <!-- Add block form -->
        <div class="pl-add-block-form form-card" style="padding:1rem">
          <div class="pl-section-label" style="margin-bottom:8px">Add time block</div>
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:end;flex-wrap:wrap">
            <div class="fg">
              <div class="flabel">Time</div>
              <input type="time" id="pl-block-time" style="width:110px"/>
            </div>
            <div class="fg">
              <div class="flabel">Task / description *</div>
              <input type="text" id="pl-block-task" placeholder="e.g. LeetCode session, System Design reading…"/>
            </div>
            <div class="fg">
              <div class="flabel">Category</div>
              <select id="pl-block-cat" style="width:130px">
                <option>DSA Practice</option>
                <option>System Design</option>
                <option>Reading</option>
                <option>Mock Interview</option>
                <option>Job Applications</option>
                <option>Break</option>
                <option>Meeting</option>
                <option>Deep Work</option>
                <option>Admin</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="btn btn-primary btn-sm" id="pl-add-block-btn"><i class="ti ti-plus"></i> Add block</button>
          </div>
        </div>
      </div>`;

    // Wire save notes
    document.getElementById('pl-save-notes-btn')?.addEventListener('click', () => {
      const notes = document.getElementById('pl-day-notes')?.value || '';
      saveDayEntry(activeDate, { notes });
      UI.toast('Notes saved ✓', 'ok');
    });

    // Wire add block
    document.getElementById('pl-add-block-btn')?.addEventListener('click', addBlock);
    document.getElementById('pl-block-task')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') addBlock();
    });

    // Wire block actions
    wireBlocks(dayEntry);
  }

  function blockHTML(b) {
    const catColors = {
      'DSA Practice':    'var(--blue)',
      'System Design':   'var(--purple)',
      'Reading':         'var(--green)',
      'Mock Interview':  'var(--red)',
      'Job Applications':'var(--amber)',
      'Break':           'var(--txt3)',
      'Meeting':         'var(--teal)',
      'Deep Work':       'var(--accent)',
      'Admin':           'var(--txt3)',
      'Other':           'var(--txt3)',
    };
    const color = catColors[b.category] || 'var(--txt3)';
    return `<div class="pl-block ${b.done ? 'pl-block-done' : ''}" id="plb-${b.id}">
      <div class="pl-block-check ${b.done ? 'checked' : ''}" data-pl-toggle="${b.id}" title="Toggle done">
        ${b.done ? '<i class="ti ti-check" style="font-size:11px"></i>' : ''}
      </div>
      <div class="pl-block-time">${b.time || '—'}</div>
      <div class="pl-block-bar" style="background:${color}"></div>
      <div class="pl-block-info">
        <div class="pl-block-task">${UI.esc(b.task)}</div>
        <div class="pl-block-cat">${UI.esc(b.category || '')}</div>
      </div>
      <button class="iBtn del" data-pl-del-block="${b.id}" title="Delete" style="flex-shrink:0"><i class="ti ti-trash"></i></button>
    </div>`;
  }

  function wireBlocks(dayEntry) {
    document.querySelectorAll('[data-pl-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id  = el.dataset.plToggle;
        const planner = Store.get('planner');
        const entry   = planner.find(e => e.date === activeDate);
        if (!entry) return;
        const block = (entry.blocks || []).find(b => b.id === id);
        if (block) { block.done = !block.done; Store.upsert('planner', entry); renderDayView(); renderWeekStrip(); }
      });
    });
    document.querySelectorAll('[data-pl-del-block]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!UI.confirm('Delete this block?')) return;
        const planner = Store.get('planner');
        const entry   = planner.find(e => e.date === activeDate);
        if (!entry) return;
        entry.blocks = (entry.blocks || []).filter(b => b.id !== btn.dataset.plDelBlock);
        Store.upsert('planner', entry);
        renderDayView();
        UI.toast('Block deleted', 'warn');
      });
    });
  }

  function addBlock() {
    const task = document.getElementById('pl-block-task')?.value.trim() || '';
    if (!task) { UI.toast('Enter a task description', 'err'); return; }
    const time = document.getElementById('pl-block-time')?.value || '';
    const cat  = document.getElementById('pl-block-cat')?.value  || 'Other';
    const block = { id: UI.uid(), time, task, category: cat, done: false, createdAt: new Date().toISOString() };

    const planner = Store.get('planner');
    let entry     = planner.find(e => e.date === activeDate);
    if (entry) {
      entry.blocks = [...(entry.blocks || []), block];
      Store.upsert('planner', entry);
    } else {
      Store.add('planner', { id: UI.uid(), date: activeDate, notes: '', blocks: [block] });
    }

    const taskEl = document.getElementById('pl-block-task'); if (taskEl) taskEl.value = '';
    const timeEl = document.getElementById('pl-block-time'); if (timeEl) timeEl.value = '';
    renderDayView();
    renderWeekStrip();
    Router.refreshBadges();
    UI.toast('Block added ✓', 'ok');
  }

  function saveDayEntry(date, patch) {
    const planner = Store.get('planner');
    let entry     = planner.find(e => e.date === date);
    if (entry) {
      Object.assign(entry, patch);
      Store.upsert('planner', entry);
    } else {
      Store.add('planner', { id: UI.uid(), date, notes: patch.notes || '', blocks: [] });
    }
    Router.refreshBadges();
  }

  return { render };
})();
