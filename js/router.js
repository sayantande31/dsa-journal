/* ═══════════════════════════════════════════════════
   router.js  — v3.1  [FIXED: 2025-prompt-3]
   Fixes:
   - Added 'log' to PAGES map (was missing, causing Log Problem page to be blank)
   - Added 'log' nav-item wiring
   - refreshBadges now null-safe for all badge IDs
═══════════════════════════════════════════════════ */
window.Router = (() => {

  const PAGES = {
    dashboard:  () => window.Pages.Dashboard.render(),
    problems:   () => window.Pages.Problems.render(),
    log:        () => window.Pages.LogForm.render(),      // FIX: was missing
    dayview:    () => window.Pages.DayView.render(),
    todo:       () => window.Pages.Todo.render(),
    revision:   () => window.Pages.Revision.render(),
    videos:     () => window.Pages.Videos.render(),
    java:       () => window.Pages.Java.render(),
    interviews: () => window.Pages.Interviews.render(),
    resume:     () => window.Pages.Resume.render(),
    knowledge:  () => window.Pages.Knowledge.render(),
    jobs:       () => window.Pages.Jobs.render(),
  };

  let current = 'dashboard';

  function goto(page) {
    if (!PAGES[page]) { console.warn('[Router] Unknown page:', page); return; }
    current = page;

    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));

    const pg  = document.getElementById('page-' + page);
    const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (pg)  pg.classList.add('active');
    if (btn) btn.classList.add('active');

    try {
      PAGES[page]();
    } catch(e) {
      console.error('[Router] Error rendering page:', page, e);
    }

    refreshBadges();
    window.scrollTo(0, 0);
  }

  function refreshBadges() {
    const s = Store.getState();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('nb-problems',   (s.problems   || []).length);
    set('nb-revision',   (s.problems   || []).filter(p => p.flagged).length);
    set('nb-todo',       (s.todos      || []).filter(t => !t.solved).length);
    set('nb-videos',     (s.videos     || []).length);
    set('nb-java',       (s.java       || []).length);
    set('nb-interviews', (s.interviews || []).length);
    set('nb-days',       new Set((s.problems || []).map(p => p.date).filter(Boolean)).size);
    set('nb-knowledge',  (s.knowledge  || []).length);
    set('nb-jobs',       (s.jobs       || []).filter(j => j.status !== 'Rejected' && j.status !== 'Withdrawn').length);
  }

  function init() {
    // Wire all nav items that have data-page attribute
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => goto(btn.dataset.page));
    });
    goto('dashboard');
  }

  return { goto, refreshBadges, init, current: () => current };
})();
