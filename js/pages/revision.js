/* ═══════════════════════════════════════════════════
   pages/revision.js  — v4.0  [2025-prompt-4]
   Two sub-tabs:
   1. Starred Queue — flagged problems (existing behaviour)
   2. Revision Tracker — log when you revisited each problem,
      filter by last week / last 30 days / specific date,
      RED highlight if not revised in 15+ days
═══════════════════════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Revision = (() => {

  let activeTab = 'queue';   // 'queue' | 'tracker'
  let trackerFilter = '7';   // days string: '7', '30', 'all', or YYYY-MM-DD

  /* ── Entry point ─────────────────────────── */
  function render() {
    renderTabs();
    if (activeTab === 'queue') renderQueue();
    else renderTracker();
  }

  /* ── Tab bar ──────────────────────────────── */
  function renderTabs() {
    const bar = document.getElementById('rev-tab-bar');
    if (!bar) return;
    bar.innerHTML = `
      <button class="rev-tab ${activeTab==='queue'?'active':''}" data-rtab="queue">
        <i class="ti ti-star"></i> Revision Queue
      </button>
      <button class="rev-tab ${activeTab==='tracker'?'active':''}" data-rtab="tracker">
        <i class="ti ti-history"></i> Revision Tracker
      </button>`;
    bar.querySelectorAll('[data-rtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.rtab;
        render();
      });
    });
  }

  /* ══════════════════════════════════════════
     SUB-TAB 1: STARRED QUEUE
  ══════════════════════════════════════════ */
  function renderQueue() {
    const qEl = document.getElementById('rev-queue-pane');
    const tEl = document.getElementById('rev-tracker-pane');
    if (qEl) qEl.style.display = 'block';
    if (tEl) tEl.style.display = 'none';

    const flagged = Store.get('problems').filter(p => p.flagged);
    const el = document.getElementById('rev-list');
    if (!el) return;

    if (!flagged.length) {
      el.innerHTML = UI.emptyState('star', 'No problems starred yet. Click ★ on any problem to add it here.');
      return;
    }

    el.innerHTML = `<div class="entries-list">${flagged.map(e => UI.entryCardHTML(e, queueActions(e))).join('')}</div>`;
    wireQueue(el);
  }

  function queueActions(e) {
    const log = Store.getRevisionLog(e.id);
    const overdue = log ? daysSince(log.lastRevised) > 15 : false;
    return `
      ${e.link ? `<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>` : ''}
      <button class="iBtn" data-mark-revised="${e.id}" title="Mark as revised today" style="color:${overdue?'var(--red)':'var(--txt3)'}">
        <i class="ti ti-refresh"></i>
      </button>
      <button class="iBtn star-on" data-rev-unflag="${e.id}" title="Remove from revision"><i class="ti ti-star"></i></button>`;
  }

  function wireQueue(el) {
    el.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => { UI.toggleCard(btn.dataset.toggle); renderQueue(); });
    });
    el.querySelectorAll('.ebtab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        UI.setCardBodyTab(btn.dataset.card, btn.dataset.tab);
        renderQueue();
      });
    });
    el.querySelectorAll('[data-rev-unflag]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Store.update('problems', btn.dataset.revUnflag, { flagged: false });
        renderQueue();
        Router.refreshBadges();
      });
    });
    el.querySelectorAll('[data-mark-revised]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Store.logRevision(btn.dataset.markRevised);
        UI.toast('Marked as revised today ✓', 'ok');
        renderQueue();
      });
    });
    el.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); UI.copy(btn.dataset.copy); });
    });
  }

  /* ══════════════════════════════════════════
     SUB-TAB 2: REVISION TRACKER
  ══════════════════════════════════════════ */
  function renderTracker() {
    const qEl = document.getElementById('rev-queue-pane');
    const tEl = document.getElementById('rev-tracker-pane');
    if (qEl) qEl.style.display = 'none';
    if (tEl) tEl.style.display = 'block';

    buildTrackerFilters();
    renderTrackerList();
  }

  function buildTrackerFilters() {
    const bar = document.getElementById('rev-tracker-filter-bar');
    if (!bar || bar._built) return;
    bar.innerHTML = `
      <button class="chip ${trackerFilter==='7'?'active':''}" data-tf="7">Last 7 days</button>
      <button class="chip ${trackerFilter==='30'?'active':''}" data-tf="30">Last 30 days</button>
      <button class="chip ${trackerFilter==='all'?'active':''}" data-tf="all">All time</button>
      <span style="font-size:11px;font-family:var(--font-mono);color:var(--txt3)">or date:</span>
      <input type="date" id="rev-tracker-date" style="width:130px;padding:5px 8px;font-size:11px;font-family:var(--font-mono);background:var(--bg3);border:1px solid var(--line2);border-radius:var(--r);color:var(--txt)"/>
    `;
    bar.querySelectorAll('[data-tf]').forEach(btn => {
      btn.addEventListener('click', () => {
        trackerFilter = btn.dataset.tf;
        const d = document.getElementById('rev-tracker-date');
        if (d) d.value = '';
        bar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        renderTrackerList();
      });
    });
    document.getElementById('rev-tracker-date')?.addEventListener('change', e => {
      if (e.target.value) {
        trackerFilter = e.target.value;
        bar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        renderTrackerList();
      }
    });
    bar._built = true;
  }

  function renderTrackerList() {
    const el = document.getElementById('rev-tracker-list');
    if (!el) return;

    const problems    = Store.get('problems');
    const revisionLog = Store.getRaw('revisionLog') || {};
    const today       = new Date();
    today.setHours(0,0,0,0);

    // Filter problems that have been studied in the time window
    const cutoff = getCutoffDate();
    const relevant = problems.filter(p => {
      if (!cutoff) return true; // 'all'
      return p.date && new Date(p.date + 'T00:00:00') >= cutoff;
    });

    if (!relevant.length) {
      el.innerHTML = UI.emptyState('history', 'No problems studied in this period');
      return;
    }

    el.innerHTML = `
      <div style="font-size:11px;font-family:var(--font-mono);color:var(--txt3);margin-bottom:10px">
        ${relevant.length} problems studied. 
        <span style="color:var(--red)">Red</span> = not revised in 15+ days.
      </div>
      <div class="entries-list">
        ${relevant.map(p => {
          const log = revisionLog[p.id];
          const days = log ? daysSince(log.lastRevised) : null;
          const overdue = days !== null && days > 15;
          const neverRevised = days === null;
          const color = overdue ? 'var(--red)' : neverRevised ? 'var(--txt3)' : 'var(--green)';
          return `<div class="entry-card" style="${overdue ? 'border-left:3px solid var(--red)' : ''}">
            <div style="padding:.75rem 1rem;display:flex;align-items:center;gap:10px">
              <div style="flex:1;min-width:0">
                <div class="entry-title" style="font-size:14px">${UI.esc(p.title)}</div>
                <div class="entry-meta-row" style="margin-top:4px">
                  <span><i class="ti ti-calendar"></i> Studied: ${UI.fmtDate(p.date)}</span>
                  <span style="color:${color}">
                    ${log ? `<i class="ti ti-refresh"></i> Revised: ${UI.fmtDate(log.lastRevised.split('T')[0])} (${days}d ago)` : '<i class="ti ti-alert-triangle"></i> Never revised'}
                  </span>
                  ${overdue ? `<span style="color:var(--red);font-weight:600">⚠ Overdue</span>` : ''}
                </div>
                ${log?.notes ? `<div style="font-size:12px;color:var(--txt3);margin-top:4px;font-style:italic">${UI.esc(log.notes)}</div>` : ''}
              </div>
              <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
                ${p.link ? `<a href="${UI.esc(p.link)}" target="_blank" rel="noopener" class="iBtn"><i class="ti ti-external-link"></i></a>` : ''}
                <button class="iBtn" data-tracker-revise="${p.id}" title="Log revision now" style="color:${overdue?'var(--red)':'var(--txt3)'}">
                  <i class="ti ti-refresh"></i>
                </button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;

    el.querySelectorAll('[data-tracker-revise]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const pid = btn.dataset.trackerRevise;
        Store.logRevision(pid);
        UI.toast('Revision logged ✓', 'ok');
        renderTrackerList();
      });
    });
  }

  function getCutoffDate() {
    if (trackerFilter === 'all') return null;
    if (trackerFilter.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Date(trackerFilter + 'T00:00:00');
    }
    const days = parseInt(trackerFilter) || 7;
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0,0,0,0);
    return d;
  }

  function daysSince(isoDate) {
    if (!isoDate) return null;
    const then = new Date(isoDate);
    const now  = new Date();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }

  return { render };
})();
