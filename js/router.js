/* ═══════════════════════════════════
   router.js — Page navigation
═══════════════════════════════════ */
window.Router = (() => {
  const PAGES = {
    dashboard:  { label: 'Dashboard',       init: () => window.Pages.Dashboard.render() },
    problems:   { label: 'Problems',        init: () => window.Pages.Problems.render()  },
    dayview:    { label: 'Day View',        init: () => window.Pages.DayView.render()   },
    todo:       { label: 'To-Do',           init: () => window.Pages.Todo.render()      },
    revision:   { label: 'Revision',        init: () => window.Pages.Revision.render()  },
    videos:     { label: 'Videos',          init: () => window.Pages.Videos.render()    },
    java:       { label: 'Java Q&A',        init: () => window.Pages.Java.render()      },
    interviews: { label: 'Interviews',      init: () => window.Pages.Interviews.render()},
    resume:     { label: 'Resume',          init: () => window.Pages.Resume.render()    },
  };

  let current = 'dashboard';

  function goto(page) {
    if (!PAGES[page]) return;
    current = page;

    // hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // update sidebar
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (btn) btn.classList.add('active');

    // init page
    PAGES[page].init();
    refreshBadges();
    window.scrollTo(0, 0);
  }

  function refreshBadges() {
    const s = Store.getState();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('nb-problems',   s.problems.length);
    set('nb-revision',   s.problems.filter(p => p.flagged).length);
    set('nb-todo',       s.todos.filter(t => !t.solved).length);
    set('nb-videos',     s.videos.length);
    set('nb-java',       s.java.length);
    set('nb-interviews', s.interviews.length);
    set('nb-days',       new Set(s.problems.map(p => p.date).filter(Boolean)).size);
  }

  function init() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => goto(btn.dataset.page));
    });
    goto('dashboard');
  }

  return { goto, refreshBadges, init, current: () => current };
})();
