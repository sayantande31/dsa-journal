/* ═══════════════════════════════════════════
   store.js — Single source of truth
   All state lives here. Gist sync lives here.
═══════════════════════════════════════════ */
window.Store = (() => {
  const GIST_FILE = 'dsa-prep-hub-data.json';
  const LS = {
    TOKEN: 'dsahub_gist_token',
    GIST:  'dsahub_gist_id',
    DATA:  'dsahub_data',
  };

  // ── State ──────────────────────────────────
  let state = {
    problems:   [],   // solved/logged problems
    todos:      [],   // todo problems (given by problem setter)
    videos:     [],
    resumes:    [],
    interviews: [],
    java:       [],
  };

  let gistToken = localStorage.getItem(LS.TOKEN) || '';
  let gistId    = localStorage.getItem(LS.GIST)  || '';
  let syncTimer = null;

  // ── Sync status callbacks ──────────────────
  let onSyncChange = () => {};
  function setSyncCb(fn) { onSyncChange = fn; }

  function setStatus(state, label) {
    onSyncChange(state, label);
  }

  // ── Local storage ─────────────────────────
  function localSave() {
    localStorage.setItem(LS.DATA, JSON.stringify(state));
    window.Router && window.Router.refreshBadges && window.Router.refreshBadges();
  }

  function localLoad() {
    try {
      const raw = localStorage.getItem(LS.DATA);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...state, ...parsed };
      }
    } catch(e) { console.warn('Local load failed', e); }
  }

  // ── Gist API ──────────────────────────────
  async function gistFetch() {
    if (!gistToken || !gistId) return false;
    setStatus('syncing', 'loading…');
    try {
      const r = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { Authorization: `token ${gistToken}`, Accept: 'application/vnd.github+json' }
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      const raw  = data.files?.[GIST_FILE]?.content;
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { problems:[], todos:[], videos:[], resumes:[], interviews:[], java:[], ...parsed };
        localSave();
      }
      setStatus('ok', 'synced ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      return true;
    } catch(e) {
      setStatus('err', 'sync error');
      console.error('Gist fetch error', e);
      return false;
    }
  }

  async function gistPush() {
    if (!gistToken) { setStatus('err', 'no token'); localSave(); return; }
    setStatus('syncing', 'saving…');
    const body = JSON.stringify(state, null, 2);
    try {
      let r;
      const payload = { files: { [GIST_FILE]: { content: body } } };
      if (gistId) {
        r = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: { Authorization: `token ${gistToken}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
          body: JSON.stringify(payload)
        });
      } else {
        r = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: { Authorization: `token ${gistToken}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
          body: JSON.stringify({ description: 'DSA Prep Hub — auto sync', public: false, ...payload })
        });
        if (r.ok) {
          const d = await r.json();
          gistId = d.id;
          localStorage.setItem(LS.GIST, gistId);
        }
      }
      if (!r.ok) throw new Error(`${r.status}`);
      setStatus('ok', 'synced ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      localSave();
    } catch(e) {
      setStatus('err', 'save failed');
      localSave();
      console.error('Gist push error', e);
    }
  }

  // debounced save — prevents hammering the API
  function save() {
    localSave();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => gistPush(), 1200);
  }

  async function manualSync() {
    if (!gistToken) return false;
    return await gistFetch();
  }

  // ── Config ────────────────────────────────
  function getConfig() { return { token: gistToken, gistId }; }

  function setConfig(token, id) {
    gistToken = token.trim();
    gistId    = id.trim();
    localStorage.setItem(LS.TOKEN, gistToken);
    localStorage.setItem(LS.GIST,  gistId);
  }

  // ── CRUD helpers ──────────────────────────
  function get(key) { return state[key] || []; }

  function add(key, item) {
    state[key] = [item, ...(state[key] || [])];
    save();
  }

  function update(key, id, patch) {
    state[key] = (state[key] || []).map(x => x.id === id ? { ...x, ...patch } : x);
    save();
  }

  function remove(key, id) {
    state[key] = (state[key] || []).filter(x => x.id !== id);
    save();
  }

  function upsert(key, item) {
    const idx = (state[key] || []).findIndex(x => x.id === item.id);
    if (idx >= 0) state[key][idx] = { ...state[key][idx], ...item };
    else state[key] = [item, ...(state[key] || [])];
    save();
  }

  // ── Export / Import ───────────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dsa-prep-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJSON(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const parsed = JSON.parse(e.target.result);
          state = { problems:[], todos:[], videos:[], resumes:[], interviews:[], java:[], ...parsed };
          await gistPush();
          res(true);
        } catch(err) { rej(err); }
      };
      reader.readAsText(file);
    });
  }

  // ── Init ──────────────────────────────────
  async function init() {
    localLoad();
    if (gistToken && gistId) {
      await gistFetch();
    } else if (!gistToken) {
      setStatus('', 'not connected');
    }
  }

  return {
    get, add, update, remove, upsert,
    save, manualSync, exportJSON, importJSON,
    getConfig, setConfig, setSyncCb,
    gistFetch, gistPush,
    init,
    getState: () => state,
  };
})();
