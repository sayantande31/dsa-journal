/* ═══════════════════════════════════════════
   store.js — Single source of truth v2
   Backward-compatible: all new keys added to state
═══════════════════════════════════════════ */
window.Store = (() => {
  const GIST_FILE = 'dsa-prep-hub-data.json';
  const LS = { TOKEN:'dsahub_gist_token', GIST:'dsahub_gist_id', DATA:'dsahub_data' };

  let state = {
    problems:   [],
    todos:      [],
    videos:     [],
    resumes:    [],
    interviews: [],
    java:       [],
    knowledge:  [],   // NEW: dynamic topic/subtopic knowledge base
    jobs:       [],   // NEW: job tracker
  };

  let gistToken = localStorage.getItem(LS.TOKEN) || '';
  let gistId    = localStorage.getItem(LS.GIST)  || '';
  let syncTimer = null;
  let onSyncChange = () => {};

  function setSyncCb(fn) { onSyncChange = fn; }
  function setStatus(s, label) { onSyncChange(s, label); }

  function localSave() {
    localStorage.setItem(LS.DATA, JSON.stringify(state));
    window.Router?.refreshBadges?.();
  }

  function localLoad() {
    try {
      const raw = localStorage.getItem(LS.DATA);
      if (raw) {
        const p = JSON.parse(raw);
        // merge: new keys get defaults, existing keys from storage win
        state = { ...state, ...p };
      }
    } catch(e) { console.warn('Local load failed', e); }
  }

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
        const p = JSON.parse(raw);
        state = { problems:[],todos:[],videos:[],resumes:[],interviews:[],java:[],knowledge:[],jobs:[], ...p };
        localSave();
      }
      setStatus('ok', 'synced ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
      return true;
    } catch(e) { setStatus('err','sync error'); return false; }
  }

  async function gistPush() {
    if (!gistToken) { setStatus('err','no token'); localSave(); return; }
    setStatus('syncing','saving…');
    const body    = JSON.stringify(state, null, 2);
    const payload = { files: { [GIST_FILE]: { content: body } } };
    try {
      let r;
      if (gistId) {
        r = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: { Authorization:`token ${gistToken}`, 'Content-Type':'application/json', Accept:'application/vnd.github+json' },
          body: JSON.stringify(payload)
        });
      } else {
        r = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: { Authorization:`token ${gistToken}`, 'Content-Type':'application/json', Accept:'application/vnd.github+json' },
          body: JSON.stringify({ description:'DSA Prep Hub — auto sync', public:false, ...payload })
        });
        if (r.ok) { const d=await r.json(); gistId=d.id; localStorage.setItem(LS.GIST,gistId); }
      }
      if (!r.ok) throw new Error(`${r.status}`);
      setStatus('ok','synced ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
      localSave();
    } catch(e) { setStatus('err','save failed'); localSave(); }
  }

  function save() {
    localSave();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => gistPush(), 1400);
  }

  async function manualSync() { if (!gistToken) return false; return gistFetch(); }
  function getConfig() { return { token:gistToken, gistId }; }
  function setConfig(token, id) {
    gistToken = token.trim(); gistId = id.trim();
    localStorage.setItem(LS.TOKEN, gistToken); localStorage.setItem(LS.GIST, gistId);
  }

  function get(key)              { return state[key] || []; }
  function add(key, item)        { state[key] = [item, ...(state[key]||[])]; save(); }
  function update(key, id, patch){ state[key] = (state[key]||[]).map(x => x.id===id ? {...x,...patch} : x); save(); }
  function remove(key, id)       { state[key] = (state[key]||[]).filter(x => x.id!==id); save(); }
  function upsert(key, item)     {
    const idx = (state[key]||[]).findIndex(x => x.id===item.id);
    if (idx>=0) state[key][idx] = {...state[key][idx],...item};
    else state[key] = [item,...(state[key]||[])];
    save();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dsa-prep-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  async function importJSON(file) {
    return new Promise((res,rej) => {
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const p = JSON.parse(e.target.result);
          state = { problems:[],todos:[],videos:[],resumes:[],interviews:[],java:[],knowledge:[],jobs:[], ...p };
          await gistPush(); res(true);
        } catch(err) { rej(err); }
      };
      reader.readAsText(file);
    });
  }

  async function init() {
    localLoad();
    if (gistToken && gistId) await gistFetch();
    else if (!gistToken) setStatus('','not connected');
  }

  return {
    get, add, update, remove, upsert, save,
    manualSync, exportJSON, importJSON,
    getConfig, setConfig, setSyncCb,
    gistFetch, gistPush, init,
    getState: () => state,
  };
})();
