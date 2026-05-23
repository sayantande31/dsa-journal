/* ═══════════════════════════════════
   pages/todo.js
   Two roles: Problem Giver + Solver
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Todo = (() => {

  function render() {
    renderTodo();
    if (!document.getElementById('todo-add-btn')._wired) {
      document.getElementById('todo-add-btn').addEventListener('click', addTodo);
      document.getElementById('todo-bulk-btn').addEventListener('click', bulkAdd);
      document.getElementById('todo-add-btn')._wired = true;

      // allow Enter key on single link input
      document.getElementById('todo-link-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') addTodo();
      });
    }
  }

  function addTodo() {
    const link  = document.getElementById('todo-link-input').value.trim();
    const title = document.getElementById('todo-title-input').value.trim();
    const date  = document.getElementById('todo-date-input').value || UI.today();
    const diff  = document.getElementById('todo-diff-input').value;
    if (!link && !title) { UI.toast('Enter at least a link or title', 'err'); return; }

    Store.add('todos', {
      id:    UI.uid(),
      title: title || link,
      link,
      date,
      difficulty: diff,
      solved: false,
      addedAt: new Date().toISOString(),
    });

    document.getElementById('todo-link-input').value  = '';
    document.getElementById('todo-title-input').value = '';
    document.getElementById('todo-date-input').value  = '';
    renderTodo();
    Router.refreshBadges();
    UI.toast('Problem added to todo ✓', 'ok');
  }

  function bulkAdd() {
    const raw = document.getElementById('todo-bulk-input').value.trim();
    if (!raw) { UI.toast('Paste problem links/titles first', 'err'); return; }
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const date  = document.getElementById('todo-date-input').value || UI.today();
    const diff  = document.getElementById('todo-diff-input').value;
    lines.forEach(line => {
      Store.add('todos', {
        id: UI.uid(),
        title: line,
        link: line.startsWith('http') ? line : '',
        date,
        difficulty: diff,
        solved: false,
        addedAt: new Date().toISOString(),
      });
    });
    document.getElementById('todo-bulk-input').value = '';
    renderTodo();
    Router.refreshBadges();
    UI.toast(`${lines.length} problem${lines.length>1?'s':''} added ✓`, 'ok');
  }

  async function markSolved(id) {
    const t = Store.get('todos').find(x => x.id === id);
    if (!t) return;

    if (!t.solved) {
      // Auto-add to problems
      Store.add('problems', {
        id:         UI.uid(),
        title:      t.title || t.link,
        category:   'DSA',
        difficulty: t.difficulty || 'Medium',
        status:     'Solved',
        date:       UI.today(),
        link:       t.link || '',
        notes:      '',
        codeTabs: [
          { id: 'brute',   label: 'Brute Force', code: '', complexity: '' },
          { id: 'optimal', label: 'Optimal',     code: '', complexity: '' },
        ],
        tags:    [],
        flagged: false,
      });
      Store.update('todos', id, { solved: true, solvedAt: UI.today() });
      UI.toast('Marked solved → added to your problems! Add code in Problems tab 💪', 'ok');
    } else {
      Store.update('todos', id, { solved: false, solvedAt: null });
      UI.toast('Marked unsolved', 'warn');
    }
    renderTodo();
    Router.refreshBadges();
  }

  function deleteTodo(id) {
    if (!UI.confirm('Remove from todo?')) return;
    Store.remove('todos', id);
    renderTodo();
    Router.refreshBadges();
  }

  function renderTodo() {
    const todos   = Store.get('todos');
    const pending = todos.filter(t => !t.solved);
    const done    = todos.filter(t =>  t.solved);

    // group pending by date
    const byDate = {};
    pending.forEach(t => {
      const d = t.date || 'No date';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });
    const sortedDates = Object.keys(byDate).sort((a,b) => a.localeCompare(b));
    const todayStr = UI.today();

    const pendingHTML = sortedDates.length
      ? sortedDates.map(date => `
        <div class="day-group" style="margin-bottom:1rem">
          <div class="day-group-header">
            <span class="day-group-date">${date === 'No date' ? 'No date' : UI.fmtDateLong(date)}</span>
            <span class="day-count-badge">${byDate[date].length} pending</span>
            ${date === todayStr ? '<span class="today-badge">Today</span>' : ''}
          </div>
          ${byDate[date].map(t => todoItemHTML(t)).join('')}
        </div>`)
        .join('')
      : UI.emptyState('checks', 'All done! No pending problems.');

    const doneHTML = done.length
      ? `<div class="entries-list">${done.map(t => todoItemHTML(t)).join('')}</div>`
      : `<div style="font-size:12px;font-family:var(--font-mono);color:var(--txt3);padding:1rem 0">No solved problems yet.</div>`;

    document.getElementById('todo-pending').innerHTML = pendingHTML;
    document.getElementById('todo-done').innerHTML    = doneHTML;
  }

  function todoItemHTML(t) {
    return `<div class="todo-item ${t.solved ? 'done' : ''}" style="margin-bottom:6px">
      <button class="todo-check ${t.solved ? 'checked' : ''}" data-check="${t.id}" title="${t.solved ? 'Mark unsolved' : 'Mark solved'}">
        ${t.solved ? '<i class="ti ti-check" style="font-size:11px"></i>' : ''}
      </button>
      <div class="todo-info">
        <div class="todo-title">${UI.esc(t.title || t.link)}</div>
        <div class="todo-meta">
          ${t.difficulty ? `<span>${t.difficulty}</span>` : ''}
          ${t.date ? `<span>${UI.fmtDate(t.date)}</span>` : ''}
          ${t.solved && t.solvedAt ? `<span style="color:var(--green)">Solved ${UI.fmtDate(t.solvedAt)}</span>` : ''}
        </div>
        ${t.link ? `<a class="todo-link" href="${UI.esc(t.link)}" target="_blank" rel="noopener">${UI.esc(t.link)}</a>` : ''}
      </div>
      <div style="display:flex;gap:4px">
        <button class="iBtn del" data-del-todo="${t.id}" title="Remove"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }

  // Wire dynamic buttons (delegated)
  document.addEventListener('click', e => {
    const check = e.target.closest('[data-check]');
    if (check) { markSolved(check.dataset.check); return; }
    const del = e.target.closest('[data-del-todo]');
    if (del) { deleteTodo(del.dataset.delTodo); return; }
  });

  return { render };
})();
