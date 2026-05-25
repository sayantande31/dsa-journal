/* ═══════════════════════════════════════════════════
   router.js — v4.0 [2025-prompt-4]
   Added: resources, planner (standalone pages)
   Revision now has sub-tabs (queue + tracker)
   Removed: java nav (merged into Knowledge Base)
   java route → knowledge (backward compat)
   videos route → resources (backward compat)
═══════════════════════════════════════════════════ */
window.Router = (() => {
  const PAGES = {
    dashboard:  () => window.Pages.Dashboard.render(),
    problems:   () => window.Pages.Problems.render(),
    log:        () => window.Pages.LogForm.render(),
    dayview:    () => window.Pages.DayView.render(),
    todo:       () => window.Pages.Todo.render(),
    revision:   () => window.Pages.Revision.render(),
    resources:  () => window.Pages.Resources.render(),
    interviews: () => window.Pages.Interviews.render(),
    resume:     () => window.Pages.Resume.render(),
    knowledge:  () => window.Pages.Knowledge.render(),
    jobs:       () => window.Pages.Jobs.render(),
    planner:    () => window.Pages.Planner.render(),
    // backward-compat aliases
    videos:     () => window.Pages.Resources.render(),
    java:       () => window.Pages.Knowledge.render(),
  };

  const ALIAS = { videos:'resources', java:'knowledge' };
  let current = 'dashboard';

  function goto(page) {
    if (!PAGES[page]) { console.warn('[Router] Unknown page:', page); return; }
    const normalized = ALIAS[page] || page;
    current = normalized;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item[data-page]').forEach(b => b.classList.remove('active'));

    const pg  = document.getElementById('page-' + normalized);
    const btn = document.querySelector(`.nav-item[data-page="${normalized}"]`);
    if (pg)  pg.classList.add('active');
    if (btn) btn.classList.add('active');

    try { PAGES[page](); } catch(e) { console.error('[Router] Error rendering:', page, e); }
    refreshBadges();
    window.scrollTo(0,0);
  }

  function refreshBadges() {
    const s = Store.getState();
    const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('nb-problems',   (s.problems  ||[]).length);
    set('nb-revision',   (s.problems  ||[]).filter(p=>p.flagged).length);
    set('nb-todo',       (s.todos     ||[]).filter(t=>!t.solved).length);
    set('nb-resources',  (s.resources ||[]).length);
    set('nb-knowledge',  (s.knowledge ||[]).length);
    set('nb-interviews', (s.interviews||[]).length);
    set('nb-days',       new Set((s.problems||[]).map(p=>p.date).filter(Boolean)).size);
    set('nb-jobs',       (s.jobs||[]).filter(j=>j.status!=='Rejected'&&j.status!=='Withdrawn').length);
    const today = new Date().toISOString().split('T')[0];
    set('nb-planner',    (s.planner||[]).filter(p=>p.date===today).length);
  }

  function init() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => goto(btn.dataset.page));
    });
    goto('dashboard');
  }

  return { goto, refreshBadges, init, current: () => current };
})();
