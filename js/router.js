/* ═══════════════════════════════════
   router.js v2 — added knowledge, jobs pages
═══════════════════════════════════ */
window.Router = (() => {
  const PAGES = {
    dashboard:  () => window.Pages.Dashboard.render(),
    problems:   () => window.Pages.Problems.render(),
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
    if (!PAGES[page]) return;
    current = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const pg  = document.getElementById('page-' + page);
    const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (pg)  pg.classList.add('active');
    if (btn) btn.classList.add('active');
    PAGES[page]();
    refreshBadges();
    window.scrollTo(0,0);
  }

  function refreshBadges() {
    const s = Store.getState();
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('nb-problems',   s.problems.length);
    set('nb-revision',   s.problems.filter(p=>p.flagged).length);
    set('nb-todo',       s.todos.filter(t=>!t.solved).length);
    set('nb-videos',     s.videos.length);
    set('nb-java',       s.java.length);
    set('nb-interviews', s.interviews.length);
    set('nb-days',       new Set(s.problems.map(p=>p.date).filter(Boolean)).size);
    set('nb-knowledge',  (s.knowledge||[]).length);
    set('nb-jobs',       (s.jobs||[]).filter(j=>j.status!=='Rejected'&&j.status!=='Withdrawn').length);
  }

  function init() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => goto(btn.dataset.page));
    });
    goto('dashboard');
  }

  return { goto, refreshBadges, init, current: () => current };
})();
