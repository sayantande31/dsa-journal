/* ═══════════════════════════════════
   ui.js — Shared UI primitives
═══════════════════════════════════ */
window.UI = (() => {

  // ── Toast ─────────────────────────────────
  let toastTimer;
  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
  }

  // ── Escape HTML ───────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── ID generator ─────────────────────────
  function uid() { return Date.now() + Math.random().toString(36).slice(2,7); }

  // ── Today's date ISO ─────────────────────
  function today() { return new Date().toISOString().split('T')[0]; }

  // ── Format date for display ───────────────
  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch { return iso; }
  }

  function fmtDateLong(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch { return iso; }
  }

  // ── Copy to clipboard ─────────────────────
  function copy(text) {
    navigator.clipboard.writeText(text).then(() => toast('Copied!', 'ok'));
  }

  // ── Confirm dialog ────────────────────────
  function confirm(msg) { return window.confirm(msg); }

  // ── Badge HTML helpers ────────────────────
  function diffBadge(d) {
    const map = { Easy: 'badge-easy', Medium: 'badge-medium', Hard: 'badge-hard' };
    return `<span class="badge ${map[d] || 'badge-status'}">${esc(d)}</span>`;
  }

  function catBadge(c) {
    const map = {
      'DSA':                  'badge-dsa',
      'System Design (LLD)':  'badge-lld',
      'System Design (HLD)':  'badge-hld',
      'Behavioral':           'badge-behav',
      'Concept / Theory':     'badge-theory',
      'Java':                 'badge-java',
    };
    return `<span class="badge ${map[c] || 'badge-status'}">${esc(c)}</span>`;
  }

  // ── Empty state ───────────────────────────
  function emptyState(icon, msg) {
    return `<div class="empty-state"><i class="ti ti-${icon}"></i><p>${msg}</p></div>`;
  }

  // ════════════════════════════════════════
  //  TAG MANAGER
  // ════════════════════════════════════════
  const PRESET_TAGS = [
    'Array','HashMap','Tree','Binary Tree','BST','Graph','DP','BFS','DFS',
    'Sliding Window','Two Pointers','Binary Search','Heap','Priority Queue',
    'Stack','Queue','Trie','Linked List','Recursion','Backtracking','Greedy',
    'Sorting','Divide & Conquer','Bit Manipulation','Math','String','Matrix',
    'Union Find','Monotonic Stack','Segment Tree','Fenwick Tree',
    'Kafka','Redis','SQL','NoSQL','Sharding','Load Balancer','CDN',
    'Microservices','OOPS','SOLID','Design Patterns','Caching',
    'Consistent Hashing','Rate Limiting','CAP Theorem','Pub-Sub','Message Queue',
    'Java 8','Streams','Collections','Concurrency','JVM','Spring','Hibernate',
    'Multithreading','Generics','Lambda','Functional Interface',
  ];

  function TagManager(containerEl, presetsEl, initialTags = []) {
    let tags = [...initialTags];

    function render() {
      containerEl.innerHTML = tags.map(t =>
        `<span class="tag-chip">${esc(t)}<button onclick="event.stopPropagation();this.closest('.tag-chip').remove()" data-tag="${esc(t)}">×</button></span>`
      ).join('') + `<input class="tag-input" placeholder="type & press Enter…" />`;

      // wire delete buttons
      containerEl.querySelectorAll('.tag-chip button').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const tag = btn.getAttribute('data-tag');
          tags = tags.filter(t => t !== tag);
          render();
        });
      });

      // wire input
      const inp = containerEl.querySelector('.tag-input');
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = inp.value.trim().replace(/,$/, '');
          if (val && !tags.includes(val)) { tags.push(val); render(); }
          else inp.value = '';
        } else if (e.key === 'Backspace' && inp.value === '' && tags.length) {
          tags.pop(); render();
        }
      });
    }

    if (presetsEl) {
      presetsEl.innerHTML = PRESET_TAGS.map(t =>
        `<button class="tpreset" data-t="${esc(t)}">${esc(t)}</button>`
      ).join('');
      presetsEl.addEventListener('click', e => {
        const t = e.target.dataset.t;
        if (t && !tags.includes(t)) { tags.push(t); render(); }
      });
    }

    render();
    return { getTags: () => tags, reset: () => { tags = []; render(); }, set: (arr) => { tags = [...arr]; render(); } };
  }

  // ════════════════════════════════════════
  //  CODE EDITOR (multi-tab)
  // ════════════════════════════════════════
  function CodeEditor(wrapEl, initialTabs = null) {
    // tabs: [{ id, label, code, complexity }]
    let tabs = initialTabs || [
      { id: 'brute',   label: 'Brute Force', code: '', complexity: '' },
      { id: 'optimal', label: 'Optimal',     code: '', complexity: '' },
    ];
    let activeTab = tabs[0].id;

    function render() {
      wrapEl.innerHTML = `
        <div class="code-editor-wrap">
          <div class="code-editor-tabs" id="ced-tabs-${wrapEl.id}">
            ${tabs.map(t => `
              <button class="ced-tab ${t.id === activeTab ? 'active' : ''}" data-id="${t.id}">${esc(t.label)}
                ${!['brute','optimal'].includes(t.id) ? `<span class="ced-del-tab" data-del="${t.id}" title="Remove tab">×</span>` : ''}
              </button>
            `).join('')}
            <button class="ced-add-tab" id="ced-add-${wrapEl.id}">+ Add approach</button>
          </div>
          ${tabs.map(t => `
            <div class="code-pane ${t.id === activeTab ? 'active' : ''}" id="cpane-${wrapEl.id}-${t.id}">
              <textarea placeholder="// ${esc(t.label)} code here\n// Time: O(?)\n// Space: O(?)">${esc(t.code)}</textarea>
              <div style="padding:6px 10px;border-top:1px solid var(--line);background:var(--bg3);display:flex;align-items:center;gap:8px">
                <span style="font-size:10px;font-family:var(--font-mono);color:var(--txt3)">COMPLEXITY</span>
                <input type="text" style="flex:1;border:none;background:none;padding:2px 4px;font-size:11px;border-radius:0" value="${esc(t.complexity)}" placeholder="e.g. Time: O(n log n)  Space: O(n)" />
              </div>
            </div>
          `).join('')}
        </div>`;

      // Tab switching
      wrapEl.querySelectorAll('.ced-tab').forEach(btn => {
        btn.addEventListener('click', e => {
          if (e.target.classList.contains('ced-del-tab')) return;
          syncCurrentPane();
          activeTab = btn.dataset.id;
          render();
        });
      });

      // Delete tab
      wrapEl.querySelectorAll('.ced-del-tab').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          syncCurrentPane();
          const delId = btn.dataset.del;
          tabs = tabs.filter(t => t.id !== delId);
          if (activeTab === delId) activeTab = tabs[0].id;
          render();
        });
      });

      // Add tab
      document.getElementById(`ced-add-${wrapEl.id}`).addEventListener('click', () => {
        syncCurrentPane();
        const label = prompt('Approach name (e.g. "Two Pass", "DP + Memoization"):');
        if (!label || !label.trim()) return;
        const id = 'custom_' + Date.now();
        tabs.push({ id, label: label.trim(), code: '', complexity: '' });
        activeTab = id;
        render();
      });
    }

    function syncCurrentPane() {
      const pane = document.getElementById(`cpane-${wrapEl.id}-${activeTab}`);
      if (!pane) return;
      const tab = tabs.find(t => t.id === activeTab);
      if (!tab) return;
      tab.code       = pane.querySelector('textarea').value;
      tab.complexity = pane.querySelector('input[type=text]').value;
    }

    function getTabs() {
      syncCurrentPane();
      return tabs.map(t => ({ ...t }));
    }

    function setTabs(newTabs) {
      tabs = newTabs.length ? [...newTabs] : [
        { id: 'brute', label: 'Brute Force', code: '', complexity: '' },
        { id: 'optimal', label: 'Optimal',   code: '', complexity: '' },
      ];
      activeTab = tabs[0].id;
      render();
    }

    function reset() {
      setTabs([
        { id: 'brute',   label: 'Brute Force', code: '', complexity: '' },
        { id: 'optimal', label: 'Optimal',     code: '', complexity: '' },
      ]);
    }

    render();
    return { getTabs, setTabs, reset };
  }

  // ════════════════════════════════════════
  //  ENTRY CARD RENDERER (problems/java)
  // ════════════════════════════════════════
  let openCards = new Set();
  let cardBodyTabs = {};

  function resetOpenCards() { openCards.clear(); cardBodyTabs = {}; }

  function toggleCard(id) {
    if (openCards.has(id)) openCards.delete(id);
    else openCards.add(id);
  }

  function setCardBodyTab(id, tab) { cardBodyTabs[id] = tab; }
  function getCardBodyTab(id) { return cardBodyTabs[id] || 'notes'; }

  function entryCardHTML(entry, actions) {
    const isOpen     = openCards.has(entry.id);
    const activeBody = getCardBodyTab(entry.id);
    const tabs       = entry.codeTabs || [];
    const dateStr    = fmtDate(entry.date);

    return `<div class="entry-card ${entry.flagged ? 'flagged' : ''} ${isOpen ? 'open' : ''}" id="ec-${entry.id}" data-id="${entry.id}">
      <div class="entry-top" data-toggle="${entry.id}">
        <i class="ti ti-chevron-right entry-chevron"></i>
        <div class="entry-main">
          <div class="entry-titlerow">
            <span class="entry-title">${esc(entry.title)}</span>
            ${entry.difficulty ? diffBadge(entry.difficulty) : ''}
            ${entry.category   ? catBadge(entry.category)   : ''}
            ${entry.status && entry.status !== 'Solved' ? `<span class="badge badge-status">${esc(entry.status)}</span>` : ''}
          </div>
          <div class="entry-meta-row">
            ${dateStr ? `<span><i class="ti ti-calendar"></i> ${dateStr}</span>` : ''}
            ${(tabs.find(t=>t.id==='optimal') || tabs[tabs.length-1])?.complexity
              ? `<span><i class="ti ti-cpu"></i> ${esc((tabs.find(t=>t.id==='optimal') || tabs[tabs.length-1]).complexity)}</span>`
              : ''}
          </div>
          ${(entry.tags||[]).length ? `<div class="entry-tags-row">${entry.tags.map(t=>`<span class="etag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="entry-actions" onclick="event.stopPropagation()">
          ${actions}
        </div>
      </div>
      ${isOpen ? entryBodyHTML(entry, activeBody) : ''}
    </div>`;
  }

  function entryBodyHTML(entry, activeBody) {
    const tabs = entry.codeTabs || [];
    const allTabs = [
      { id: 'notes',   label: 'Notes' },
      ...tabs.map(t => ({ id: 'code_' + t.id, label: t.label || t.id })),
      ...(entry.link ? [{ id: 'link', label: 'Problem Link' }] : []),
    ];
    if (!allTabs.find(t => t.id === activeBody)) {
      activeBody = 'notes';
    }

    return `<div class="entry-body">
      <div class="entry-body-tabs">
        ${allTabs.map(t => `<button class="ebtab ${t.id === activeBody ? 'active' : ''}" data-card="${entry.id}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}
      </div>
      <div class="entry-body-pane ${activeBody === 'notes' ? 'active' : ''}" id="ebp-${entry.id}-notes">
        ${entry.notes ? `<div class="notes-block">${esc(entry.notes)}</div>` : `<div class="empty-pane">No notes added</div>`}
      </div>
      ${tabs.map(t => {
        const paneId = 'code_' + t.id;
        return `<div class="entry-body-pane ${activeBody === paneId ? 'active' : ''}" id="ebp-${entry.id}-${paneId}">
          ${t.code
            ? `<div class="code-display"><button class="copy-btn" data-copy="${esc(t.code)}">copy</button><code>${esc(t.code)}</code></div>
               ${t.complexity ? `<div class="cx-chips"><span class="cx-chip"><strong>Complexity:</strong> ${esc(t.complexity)}</span></div>` : ''}`
            : `<div class="empty-pane">No code for this approach</div>`}
        </div>`;
      }).join('')}
      ${entry.link ? `<div class="entry-body-pane ${activeBody === 'link' ? 'active' : ''}" id="ebp-${entry.id}-link">
        <div class="link-display">
          <i class="ti ti-link" style="color:var(--txt3)"></i>
          <a href="${esc(entry.link)}" target="_blank" rel="noopener">${esc(entry.link)}</a>
          <button class="iBtn" data-copy="${esc(entry.link)}" title="Copy"><i class="ti ti-copy"></i></button>
        </div>
      </div>` : ''}
    </div>`;
  }

  // Wire entry card events after render
  function wireCards(containerEl, onToggle, onBodyTab, onCopy) {
    containerEl.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.toggle;
        onToggle(id);
      });
    });
    containerEl.querySelectorAll('.ebtab').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        onBodyTab(btn.dataset.card, btn.dataset.tab);
      });
    });
    containerEl.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        copy(btn.dataset.copy);
      });
    });
  }

  return {
    toast, esc, uid, today, fmtDate, fmtDateLong, copy,
    confirm: (msg) => window.confirm(msg),
    diffBadge, catBadge, emptyState,
    TagManager, CodeEditor,
    openCards, cardBodyTabs,
    resetOpenCards, toggleCard, setCardBodyTab, getCardBodyTab,
    entryCardHTML, wireCards,
  };
})();
