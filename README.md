# DSA Prep Hub — v3.1

> A personal interview-prep portal for senior engineers. Tracks problems solved, system design notes, Java Q&A, job applications, knowledge base, resume bank, and interview experiences — all synced across devices via a private GitHub Gist.

---

## Project Structure

```
dsa-prep-hub/
├── index.html                  ← App shell + all page HTML + bootstrap script
├── css/
│   └── main.css                ← Full design system (tokens, layout, components)
├── js/
│   ├── store.js                ← Single source of truth + GitHub Gist sync
│   ├── ui.js                   ← Shared UI primitives (TagManager, CodeEditor, cards)
│   ├── router.js               ← Client-side router (page switching + badge updates)
│   └── pages/
│       ├── dashboard.js        ← Dashboard, heatmap, streak, recent problems
│       ├── problems.js         ← Log Problem form (LogForm) + Problems list
│       ├── todo.js             ← To-Do problems, solve modal, bulk add
│       ├── sections.js         ← DayView, Revision, Videos, Java Q&A, Interviews, Resume
│       ├── knowledge.js        ← Knowledge Base (dynamic topics + subtopics)
│       └── jobs.js             ← Job Tracker (status, credentials, password eye toggle)
└── README.md
```

### Architecture decisions

| Concern | Decision |
|---|---|
| State management | Single `Store` module (IIFE), all state in one JSON blob |
| Persistence | `localStorage` (immediate) + GitHub Gist (debounced 1.4s after every write) |
| Routing | Thin custom router — just CSS class toggling + page render calls |
| Wiring pattern | DOM element `._wired` flag (not module-level booleans) prevents double-binding while surviving re-renders |
| Code editor | Multi-tab, custom approach tabs, built into `UI.CodeEditor()` |
| Tags | Free-text input + preset chips, managed by `UI.TagManager()` |

---

## Deploy to GitHub Pages (step by step)

### Prerequisites
- A GitHub account
- Git installed locally (or use GitHub's web UI)

### Step 1 — Create the repository

1. Go to **github.com → + → New repository**
2. Name: `dsa-prep-hub` (or anything you like)
3. Set to **Public** (required for free GitHub Pages)
4. **Do NOT** initialize with README (you already have files)
5. Click **Create repository**

### Step 2 — Push the files

```bash
cd path/to/dsa-prep-hub
git init
git add .
git commit -m "initial: dsa prep hub v3.1"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dsa-prep-hub.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings** tab
3. Left sidebar → **Pages**
4. Under **Branch**: select `main`, folder `/root`
5. Click **Save**
6. Wait ~60 seconds, refresh — your URL appears:
   `https://YOUR_USERNAME.github.io/dsa-prep-hub`

---

## Configure GitHub Gist Sync (cross-device persistence)

Without Gist sync, data lives only in the browser's `localStorage`. Setting up Gist sync takes 3 minutes and means your data follows you across devices.

### Step 1 — Create a Personal Access Token

1. Go to: **github.com/settings/tokens/new**  
   (Fine-grained tokens also work — enable Gist read/write)
2. **Token name**: `DSA Prep Hub`
3. **Expiration**: No expiration (or set a long one)
4. **Scopes**: tick only ✅ **gist**
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again)

### Step 2 — Connect in the app

1. Open your deployed site
2. Click the sync pill in the top bar (shows "not connected") **or** use the sidebar **Gist Sync** link
3. Paste your token
4. Leave **Gist ID** blank (auto-created on first save)
5. Click **Save & Connect**
6. The sync dot turns green — your data is now synced ✓

### Step 3 — Open on another device

1. Navigate to `https://YOUR_USERNAME.github.io/dsa-prep-hub`
2. Click **Gist Sync** → paste the same token → paste the Gist ID shown in first device → **Save & Connect**
3. Data loads automatically

> **Tip:** After first connect, copy the auto-filled Gist ID and keep it safe. You'll need it when setting up new devices.

---

## Features

| Section | What it does |
|---|---|
| **Dashboard** | Stats, difficulty progress bars, 16-week activity heatmap, streak counter |
| **To-Do Problems** | Problem setter adds links/titles (single or bulk). Solver clicks ✓ Solve → fills in code + notes → gets added to Problems Solved. No duplicates on re-solve. |
| **Log Problem** | Separate clean page. Multi-tab code editor (Brute Force, Optimal, + custom approaches). Custom tags. YouTube reference links. |
| **Problems Solved** | Filter by category, difficulty, date range, today button. Full-text search across title/notes/code. |
| **Day View** | Problems grouped by date. Filter by month OR exact date. |
| **Revision Queue** | Starred problems. One click to un-star. |
| **Java Q&A** | Category-filtered question bank with code editor and tags. |
| **Knowledge Base** | Dynamic topics → subtopics. Each subtopic: text, code snippet, multiple links, uploaded images (base64). |
| **Resources** | Video/article library with YouTube thumbnail auto-load, multiple links per entry, watched status. |
| **Interviews** | Log company/round/questions/experience/outcome. Expandable cards. |
| **Job Tracker** | Track applications with status pipeline, portal credentials (password masked/eye toggle), date filters. |
| **Resume / CV** | Upload PDFs as base64, download any time. Stored in your Gist. |

---

## Updating the app

When a new version is released, replace only the changed files:

```bash
# Download new files, then:
git add js/router.js js/pages/problems.js js/pages/sections.js index.html
git commit -m "fix: v3.1 — log form wiring, knowledge clicks, interview search"
git push
```

GitHub Pages redeploys automatically within ~1 minute.

---

## Bug Fix Log

### v3.1 — 2025-prompt-3

| File | Bug | Fix |
|---|---|---|
| `js/router.js` | `'log'` page was missing from the `PAGES` map. Clicking "Log Problem" in sidebar toggled CSS but never called `LogForm.render()`, so the code editor and buttons were never initialized. | Added `log: () => window.Pages.LogForm.render()` to `PAGES`. |
| `js/pages/problems.js` | `LogForm` used a module-level `wired` boolean. `Pages.LogForm.render()` was called at app boot, setting `wired=true`. Every subsequent navigation to the log page hit `if(wired) return` and did nothing. | Changed to DOM element `._wired` flag on the save button. Idempotent on repeat calls, but correctly skips if already wired. |
| `js/pages/sections.js` | All pages (Java, Interviews, Videos, Resume) used module-level `wired` booleans that fired correctly on first visit but could fail after certain navigation patterns. `int-search` listener was attached at script-load time (outside any function), causing a potential null-ref before DOM was ready. | Converted all guards to `element._wired` flags. Moved `int-search` wiring inside `Interviews.render()`. |
| `index.html` | `Pages.LogForm.render()` was called during app boot (`async init()`), which set the `wired` flag before user ever visited the page. | Removed that call. Router handles it correctly via the `PAGES` map. |

---

## Data model

```jsonc
{
  "problems":   [{ id, title, category, difficulty, status, date, link, ytLinks, notes, codeTabs, tags, flagged, fromTodo }],
  "todos":      [{ id, title, link, date, difficulty, solved, solvedProblemId, solvedAt, addedAt }],
  "videos":     [{ id, title, url, extraLinks, topic, status, addedAt }],
  "resumes":    [{ id, label, note, fileName, dataURL, addedAt }],
  "interviews": [{ id, company, role, round, date, status, questions, experience, outcome }],
  "java":       [{ id, title, category, difficulty, notes, codeTabs, tags, flagged, date }],
  "knowledge":  [{ id, name, subs: [{ id, title, notes, links, code, images, updatedAt }], createdAt }],
  "jobs":       [{ id, company, role, link, portal, username, password, status, date, notes, updatedAt }]
}
```

All data is stored as a single JSON file in your private GitHub Gist: `dsa-prep-hub-data.json`.

---

## Security note on Job Tracker passwords

Passwords in the Job Tracker are stored **as plain text in your private GitHub Gist**. This is only appropriate for low-stakes portal passwords (job board logins). Do not store banking or critical passwords here. The eye-toggle feature is client-side only.

---

*Built for senior engineers grinding towards their next role. Ship it, track it, land it.*
