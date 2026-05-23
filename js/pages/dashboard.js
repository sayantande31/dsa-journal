/* ═══════════════════════════════════
   pages/dashboard.js
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Dashboard = (() => {

  function render() {
    const problems   = Store.get('problems');
    const todos      = Store.get('todos');
    const today      = UI.today();

    // stats
    const total      = problems.length;
    const dsa        = problems.filter(p => p.category === 'DSA').length;
    const sd         = problems.filter(p => (p.category||'').includes('System')).length;
    const todayCount = problems.filter(p => p.date === today).length;
    const flagged    = problems.filter(p => p.flagged).length;
    const pending    = todos.filter(t => !t.solved).length;

    document.getElementById('db-stats').innerHTML = `
      <div class="stat-card"><div class="stat-accent-bar" style="background:var(--accent)"></div>
        <div class="stat-label">Total Solved</div><div class="stat-val">${total}</div>
        <div class="stat-sub">all categories</div></div>
      <div class="stat-card"><div class="stat-accent-bar" style="background:var(--blue)"></div>
        <div class="stat-label">Today</div><div class="stat-val">${todayCount}</div>
        <div class="stat-sub">${UI.fmtDate(today)}</div></div>
      <div class="stat-card"><div class="stat-accent-bar" style="background:var(--purple)"></div>
        <div class="stat-label">System Design</div><div class="stat-val">${sd}</div>
        <div class="stat-sub">LLD + HLD</div></div>
      <div class="stat-card"><div class="stat-accent-bar" style="background:var(--amber)"></div>
        <div class="stat-label">Pending ToDo</div><div class="stat-val">${pending}</div>
        <div class="stat-sub">${flagged} flagged for revision</div></div>`;

    // progress bars
    const easy = problems.filter(p => p.difficulty === 'Easy').length;
    const med  = problems.filter(p => p.difficulty === 'Medium').length;
    const hard = problems.filter(p => p.difficulty === 'Hard').length;
    const mx   = Math.max(easy, med, hard, 1);
    document.getElementById('db-progress').innerHTML = `
      <div class="prog-card">
        <div class="prog-label">Easy</div>
        <div class="prog-track"><div class="prog-bar" style="width:${Math.round(easy/mx*100)}%;background:var(--green)"></div></div>
        <div class="prog-nums"><span>solved</span><b>${easy}</b></div></div>
      <div class="prog-card">
        <div class="prog-label">Medium</div>
        <div class="prog-track"><div class="prog-bar" style="width:${Math.round(med/mx*100)}%;background:var(--amber)"></div></div>
        <div class="prog-nums"><span>solved</span><b>${med}</b></div></div>
      <div class="prog-card">
        <div class="prog-label">Hard</div>
        <div class="prog-track"><div class="prog-bar" style="width:${Math.round(hard/mx*100)}%;background:var(--red)"></div></div>
        <div class="prog-nums"><span>solved</span><b>${hard}</b></div></div>`;

    // streak
    const dateSet = new Set(problems.map(p => p.date).filter(Boolean));
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 180; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (dateSet.has(ds)) streak++;
      else if (i > 0) break;
    }
    document.getElementById('db-streak').textContent = `🔥 ${streak} day streak`;

    // heatmap
    renderHeatmap(problems, document.getElementById('db-heatmap'));

    // recent
    const recent = problems.slice(0, 5);
    const el = document.getElementById('db-recent');
    if (!recent.length) {
      el.innerHTML = UI.emptyState('plus', 'No problems logged yet — click "Log Problem" to start');
    } else {
      UI.resetOpenCards();
      el.innerHTML = recent.map(e => UI.entryCardHTML(e, problemActions(e))).join('');
      wireRecent(el);
    }
  }

  function renderHeatmap(problems, container) {
    const WEEKS = 16;
    const counts = {};
    problems.forEach(p => { if (p.date) counts[p.date] = (counts[p.date] || 0) + 1; });
    const now = new Date();
    const days = [];
    for (let i = WEEKS * 7 - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const cols = [];
    for (let w = 0; w < WEEKS; w++) cols.push(days.slice(w * 7, (w + 1) * 7));

    const dayLabels = ['S','M','T','W','T','F','S'];
    container.innerHTML = `
      <div class="heatmap-body">
        <div class="heatmap-day-labels">${dayLabels.map(l=>`<div class="hday-label">${l}</div>`).join('')}</div>
        <div class="heatmap-cols">
          ${cols.map(week => `<div class="heatmap-col">
            ${week.map(ds => {
              const n = counts[ds] || 0;
              const lv = n === 0 ? '' : n === 1 ? 'lv1' : n <= 2 ? 'lv2' : n <= 4 ? 'lv3' : 'lv4';
              return `<div class="hm ${lv}" title="${ds}: ${n} problem${n !== 1 ? 's' : ''}"></div>`;
            }).join('')}
          </div>`).join('')}
        </div>
      </div>
      <div class="heatmap-legend">
        <span>Less</span>
        <div class="hleg" style="background:var(--bg4)"></div>
        <div class="hleg" style="background:#1e3a10"></div>
        <div class="hleg" style="background:#3a6e1e"></div>
        <div class="hleg" style="background:#6ab32a"></div>
        <div class="hleg" style="background:var(--accent)"></div>
        <span>More</span>
      </div>`;
  }

  function problemActions(e) {
    return `
      ${e.link ? `<a href="${UI.esc(e.link)}" target="_blank" rel="noopener" class="iBtn" title="Open"><i class="ti ti-external-link"></i></a>` : ''}
      <button class="iBtn ${e.flagged ? 'star-on' : ''}" data-flag="${e.id}" title="Revision"><i class="ti ti-star"></i></button>`;
  }

  function wireRecent(el) {
    el.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggle;
        UI.toggleCard(id);
        render();
      });
    });
    el.querySelectorAll('[data-flag]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.flag;
        const prob = Store.get('problems').find(p => p.id == id);
        if (prob) { Store.update('problems', id, { flagged: !prob.flagged }); render(); }
      });
    });
    el.querySelectorAll('.ebtab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        UI.setCardBodyTab(btn.dataset.card, btn.dataset.tab);
        render();
      });
    });
    el.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); UI.copy(btn.dataset.copy); });
    });
  }

  return { render, renderHeatmap };
})();
