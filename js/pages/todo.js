/* ═══════════════════════════════════
   pages/todo.js  v2
   Fix: mark-solved opens a modal to fill details BEFORE adding to problems
   Fix: uncheck→check removes old problem entry, creates fresh one (no duplicates)
═══════════════════════════════════ */
window.Pages = window.Pages || {};
window.Pages.Todo = (() => {

  /* ── wiring guard ─────────────────── */
  let wired = false;

  function render() {
    renderTodo();
    if (!wired) {
      document.getElementById('todo-add-btn').addEventListener('click', addTodo);
      document.getElementById('todo-bulk-btn').addEventListener('click', bulkAdd);
      document.getElementById('todo-link-input').addEventListener('keydown', e => { if(e.key==='Enter') addTodo(); });
      document.getElementById('todo-solve-confirm-btn').addEventListener('click', confirmSolve);
      document.getElementById('todo-solve-cancel-btn').addEventListener('click', closeSolveModal);
      document.getElementById('todo-solve-modal').addEventListener('click', e => { if(e.target===e.currentTarget) closeSolveModal(); });
      wired = true;
    }
  }

  /* ── Add single ───────────────────── */
  function addTodo() {
    const link  = document.getElementById('todo-link-input').value.trim();
    const title = document.getElementById('todo-title-input').value.trim();
    const date  = document.getElementById('todo-date-input').value || UI.today();
    const diff  = document.getElementById('todo-diff-input').value;
    if (!link && !title) { UI.toast('Enter at least a link or title','err'); return; }
    Store.add('todos', { id:UI.uid(), title:title||link, link, date, difficulty:diff, solved:false, solvedProblemId:null, addedAt:new Date().toISOString() });
    document.getElementById('todo-link-input').value  = '';
    document.getElementById('todo-title-input').value = '';
    document.getElementById('todo-date-input').value  = '';
    renderTodo(); Router.refreshBadges();
    UI.toast('Added to todo ✓','ok');
  }

  /* ── Bulk add ─────────────────────── */
  function bulkAdd() {
    const raw  = document.getElementById('todo-bulk-input').value.trim();
    if (!raw) { UI.toast('Paste links/titles first','err'); return; }
    const date = document.getElementById('todo-date-input').value || UI.today();
    const diff = document.getElementById('todo-diff-input').value;
    raw.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line => {
      Store.add('todos', { id:UI.uid(), title:line, link:line.startsWith('http')?line:'', date, difficulty:diff, solved:false, solvedProblemId:null, addedAt:new Date().toISOString() });
    });
    document.getElementById('todo-bulk-input').value = '';
    renderTodo(); Router.refreshBadges();
    UI.toast('Problems added ✓','ok');
  }

  /* ── Solve modal ──────────────────── */
  let solvingTodoId = null;

  function openSolveModal(todoId) {
    const t = Store.get('todos').find(x=>x.id===todoId); if (!t) return;
    solvingTodoId = todoId;
    document.getElementById('ts-title').value    = t.title || t.link || '';
    document.getElementById('ts-link').value     = t.link  || '';
    document.getElementById('ts-diff').value     = t.difficulty || 'Medium';
    document.getElementById('ts-cat').value      = 'DSA';
    document.getElementById('ts-status').value   = 'Solved';
    document.getElementById('ts-date').value     = UI.today();
    document.getElementById('ts-notes').value    = '';
    document.getElementById('ts-brute').value    = '';
    document.getElementById('ts-optimal').value  = '';
    document.getElementById('ts-cx-b').value     = '';
    document.getElementById('ts-cx-o').value     = '';
    // reset solve code tabs
    document.getElementById('ts-tab-brute').classList.add('active');
    document.getElementById('ts-tab-optimal').classList.remove('active');
    document.getElementById('ts-pane-brute').style.display   = 'block';
    document.getElementById('ts-pane-optimal').style.display = 'none';
    document.getElementById('todo-solve-modal').classList.remove('hidden');
  }

  function closeSolveModal() {
    document.getElementById('todo-solve-modal').classList.add('hidden');
    solvingTodoId = null;
  }

  function confirmSolve() {
    if (!solvingTodoId) return;
    const t = Store.get('todos').find(x=>x.id===solvingTodoId); if (!t) return;

    // If already had a linked problem, remove it first (re-solve = replace)
    if (t.solvedProblemId) {
      Store.remove('problems', t.solvedProblemId);
    }

    const newProbId = UI.uid();
    Store.add('problems', {
      id:         newProbId,
      title:      document.getElementById('ts-title').value.trim()  || t.title || t.link,
      category:   document.getElementById('ts-cat').value,
      difficulty: document.getElementById('ts-diff').value,
      status:     document.getElementById('ts-status').value,
      date:       document.getElementById('ts-date').value || UI.today(),
      link:       document.getElementById('ts-link').value.trim(),
      notes:      document.getElementById('ts-notes').value.trim(),
      codeTabs: [
        { id:'brute',   label:'Brute Force', code: document.getElementById('ts-brute').value,   complexity: document.getElementById('ts-cx-b').value },
        { id:'optimal', label:'Optimal',     code: document.getElementById('ts-optimal').value, complexity: document.getElementById('ts-cx-o').value },
      ],
      tags:       [],
      flagged:    false,
      fromTodo:   solvingTodoId,
    });

    Store.update('todos', solvingTodoId, { solved:true, solvedAt:UI.today(), solvedProblemId:newProbId });
    closeSolveModal();
    renderTodo(); Router.refreshBadges();
    UI.toast('Solved! Added to Problems ✓','ok');
  }

  /* ── Unsolve ──────────────────────── */
  function markUnsolved(todoId) {
    const t = Store.get('todos').find(x=>x.id===todoId); if (!t) return;
    if (t.solvedProblemId) Store.remove('problems', t.solvedProblemId);
    Store.update('todos', todoId, { solved:false, solvedAt:null, solvedProblemId:null });
    renderTodo(); Router.refreshBadges();
    UI.toast('Marked unsolved — problem entry removed','warn');
  }

  function deleteTodo(id) {
    if (!UI.confirm('Remove this todo?')) return;
    const t = Store.get('todos').find(x=>x.id===id);
    if (t?.solvedProblemId) Store.remove('problems', t.solvedProblemId);
    Store.remove('todos', id);
    renderTodo(); Router.refreshBadges();
  }

  /* ── Render ───────────────────────── */
  function renderTodo() {
    const todos   = Store.get('todos');
    const pending = todos.filter(t=>!t.solved);
    const done    = todos.filter(t=> t.solved);
    const byDate  = {};
    pending.forEach(t => { const d=t.date||'No date'; if(!byDate[d]) byDate[d]=[]; byDate[d].push(t); });
    const sortedDates = Object.keys(byDate).sort((a,b)=>a.localeCompare(b));
    const todayStr = UI.today();

    document.getElementById('todo-pending').innerHTML = sortedDates.length
      ? sortedDates.map(date => `
          <div class="day-group" style="margin-bottom:1rem">
            <div class="day-group-header">
              <span class="day-group-date">${date==='No date'?'No date':UI.fmtDateLong(date)}</span>
              <span class="day-count-badge">${byDate[date].length} pending</span>
              ${date===todayStr?'<span class="today-badge">Today</span>':''}
            </div>
            ${byDate[date].map(t=>todoItemHTML(t)).join('')}
          </div>`).join('')
      : UI.emptyState('checks','All done! No pending problems.');

    document.getElementById('todo-done').innerHTML = done.length
      ? done.map(t=>todoItemHTML(t)).join('')
      : `<div style="font-size:12px;font-family:var(--font-mono);color:var(--txt3);padding:.5rem 0">No solved problems yet.</div>`;
  }

  function todoItemHTML(t) {
    return `<div class="todo-item ${t.solved?'done':''}" style="margin-bottom:6px">
      <div class="todo-check ${t.solved?'checked':''}" title="${t.solved?'Undo solved':'Mark solved'}"
           onclick="${t.solved ? `Pages.Todo._unsolveTodo('${t.id}')` : `Pages.Todo._solveTodo('${t.id}')`}">
        ${t.solved?'<i class="ti ti-check" style="font-size:11px"></i>':''}
      </div>
      <div class="todo-info">
        <div class="todo-title">${UI.esc(t.title||t.link)}</div>
        <div class="todo-meta">
          ${t.difficulty?`<span>${t.difficulty}</span>`:''}
          ${t.date?`<span>${UI.fmtDate(t.date)}</span>`:''}
          ${t.solved&&t.solvedAt?`<span style="color:var(--green)">✓ Solved ${UI.fmtDate(t.solvedAt)}</span>`:''}
        </div>
        ${t.link?`<a class="todo-link" href="${UI.esc(t.link)}" target="_blank" rel="noopener">${UI.esc(t.link)}</a>`:''}
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        ${!t.solved?`<button class="btn btn-primary btn-xs" onclick="Pages.Todo._solveTodo('${t.id}')"><i class="ti ti-check"></i> Solve</button>`:''}
        <button class="iBtn del" onclick="Pages.Todo._deleteTodo('${t.id}')" title="Remove"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
  }

  // exposed for inline onclick
  return {
    render,
    _solveTodo:   (id) => openSolveModal(id),
    _unsolveTodo: (id) => markUnsolved(id),
    _deleteTodo:  (id) => deleteTodo(id),
  };
})();
