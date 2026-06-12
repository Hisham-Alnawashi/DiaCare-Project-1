# DiaCare — Skills.md

> A guide for AI coding agents working on the **DiaCare** diabetes-management web app.
> Read this before touching any file. It documents the project structure, contracts, and conventions so changes stay consistent.

---

## 1. Project Snapshot

**DiaCare** is a bilingual (English / Arabic, LTR / RTL) single-page-app-style diabetes management tool. It logs blood glucose, weight, and meals; renders a personalized diet plan per diabetes type (Type 1, Type 2, Gestational, Pediatric); computes insulin bolus estimates; and ships a local rule-based medical chatbot aligned with ADA guidance.

The app is a **static frontend + thin Node/Express stub backend**. There is no build step. The frontend is plain HTML / CSS / vanilla JS, with Firebase (Auth + Firestore) loaded from `gstatic.com` CDN.

### Tech Stack
- **Frontend:** HTML5, vanilla JavaScript (ES modules + classic scripts), CSS (CSS variables, custom properties, no preprocessor)
- **Charts:** Chart.js (CDN) — used only on `reports.html`
- **PDF export:** html2pdf.js (CDN) — used only on `reports.html`
- **Icons:** Font Awesome 6.0.0 (CDN)
- **Fonts:** Inter (Latin) + Cairo (Arabic), via Google Fonts
- **Auth / DB:** Firebase 10.8.1 (Auth + Firestore) via `gstatic.com` CDN
- **Backend stub:** Node.js 18+, Express 5.2.1, CORS 2.8.6 — single `/api/ai` endpoint that proxies to Google Gemini
- **Dev tooling:** VS Code Live Server (port **5501**, set in `.vscode/settings.json`)

### How to Run
1. **Frontend:** open the project in VS Code, right-click `front/log in/index.html` → "Open with Live Server" (port 5501). No build, no install needed for the frontend.
2. **Backend stub (optional):** from the repo root run `npm install` once, then `node "front/log in/server.js"`. It listens on `http://localhost:3000`. The `/api/ai` route proxies to `generativelanguage.googleapis.com` and **requires a real Gemini API key** (see Section 13).

The frontend works fully without the backend; the backend only exists to relay chat prompts to Gemini in a future iteration.

---

## 2. Directory Map

```
DiaCare-Project/
├── package.json                        # Root Node manifest (express, cors). Used only by server.js.
├── package-lock.json                   # Lock file
├── .vscode/
│   └── settings.json                   # Live Server port: 5501
└── front/
    └── log in/                         # ALL app code lives in this folder
                                          # Note: folder name contains a SPACE; preserve exactly.
        ├── index.html                  # Login + Signup tabs, hero/info panel, chatbot widget
        ├── dashboard.html              # Main app: glucose log, weight/BMI, meal tracker,
        │                               # insulin bolus calculator, smart suggestions, BG chart
        ├── nutrition.html              # Personalized diet plan (4 types) + daily tips sidebar
        ├── reports.html                # Monthly overview, time-in-range, 30-day trend chart,
        │                               # PDF export
        ├── settings.html               # Account info, language/theme preferences, password change
        ├── script.js                   # CORE module: Firebase init, DiaCareDB facade,
        │                               # auth forms, chatbot, logout, dashboard event wiring
        ├── server.js                   # Express stub exposing POST /api/ai → Gemini proxy
        ├── i18n.js                     # Bilingual EN/AR dictionary + applyTranslations()
        ├── nutrition.js                # Renders personalized diet plan HTML,
        │                               # binds "Print" + selector, duplicates chatbot logic
        ├── reports.js                  # Renders Chart.js 30-day trend, computes A1C,
        │                               # drives html2pdf.js export, duplicates chatbot logic
        ├── settings.js                 # Wires settings form, sync theme/lang/type selectors,
        │                               # duplicates chatbot logic
        └── styles.css                  # Single global stylesheet (1072 lines): variables,
                                        # theming, RTL, dashboard layout, chatbot UI
```

There is **no `src/`, no `dist/`, no `assets/`, no `tests/`** folder. Everything is flat inside `front/log in/`.

---

## 3. Key Files Deep-Dive

### 3.1 `front/log in/index.html` (241 lines)
**Purpose:** Landing page with Login + Signup tabs and the chatbot widget.
**Key IDs / classes:**
- `#form-login`, `#form-signup`, `#tab-login`, `#tab-signup` (tab UI)
- `#login-email`, `#login-password`, `#signup-fname`, `#signup-lname`, `#signup-email`, `#signup-password`, `#signup-dob`, `#signup-type`
- `#theme-toggle`, `#lang-toggle`
- `.chatbot-widget` → `#chatbot-toggle`, `#chatbot-window`, `#chat-messages`, `#chat-input`, `#chat-send`
**Scripts loaded (in order):** `<script type="module" src="script.js">` then `i18n.js` then an inline theme toggle handler.
**Gotchas:**
- Auto-redirect-to-dashboard block in `script.js:142-150` is **commented out** (intentionally). Don't re-enable without re-testing.
- Inline `<script>` at the bottom handles the theme icon swap; this is duplicated across pages.

### 3.2 `front/log in/dashboard.html` (1302→1304 lines — the largest file)
**Purpose:** The heart of the app. Sidebar + 5 cards (glucose, weight/BMI, meal, bolus, suggestion) + 1 chart + chatbot widget.
**Key IDs:**
- `#user-diabetes-type` (sidebar selector — drives every threshold calculation)
- `#measurement-context` (fasting / post-meal / random)
- `#gestational-time-group`, `#gestational-time` (only shown for gestational + post-meal)
- `#glucose-input`, `#log-glucose-btn`, `#glucose-badge`
- `#height-input`, `#target-weight-input`, `#weight-input`, `#log-weight-btn`, `#calc-bmi`, `#weight-diff`, `#weight-progress`
- `#meal-input`, `#meal-datalist`, `#log-meal-btn`, `#calc-carbs`, `#calc-impact`
- `#bolusCarbsInput`, `#calc-bolus-dose`, `#btn-analyze-ai`
- `#suggestion-content`, `#smart-health-banner`, `#banner-icon`, `#banner-message`, `#banner-ai-btn`
- `#dailyBgChart` (canvas — see Tech Debt §11)
- `#logout-btn` (sidebar)
**Key class hooks:** `.dashboard-container`, `.sidebar`, `.main-content`, `.card`, `.flash-red-alert`, `.glucose-input-wrapper`, `.progress-container`, `.progress-bar`
**Embedded data:** `<datalist id="meal-datalist">` contains ~80 Arab/Middle-Eastern meals with `data-carbs` attribute (used by JS for carb lookup).
**Embedded inline JS:** ~750 lines of vanilla JS run on `DOMContentLoaded` — see dashboard's `updateDashboard()`, `simulateMealTracking()`, `updateHealthBanner()`, `handleChatSubmit()`, and the bolus calculator. This file is a mix of markup and logic.
**Gotchas:**
- A `<select id="user-physio-context">` and a `<select id="meal-search-input">` are referenced in the inline JS but **do not exist in the DOM** (see Tech Debt).
- The `dailyBgChart` canvas exists, but `renderDailyChart()` is never defined anywhere.
- Two `<span data-i18n>` button labels live inside `btn-analyze-ai` (lines 435-436) — they will both render. Don't "fix" without intent.

### 3.3 `front/log in/nutrition.html` (155 lines)
**Purpose:** Renders a personalized diet plan card + daily tips sidebar.
**Key IDs:**
- `#personalized-diet-plan` (target of `renderDietPlan()` from `nutrition.js`)
- `#diet-plan-selector`, `#print-diet-btn` (created dynamically by JS)
- `#user-greeting`, `#logout-btn`
**Scripts loaded (in order):** `i18n.js`, then `nutrition.js`, then `<script type="module" src="script.js">`.
**Note:** `nutrition.js` is non-module but `script.js` is `type="module"`. The `chatBotAttached` guard in `script.js` prevents double-binding.

### 3.4 `front/log in/reports.html` (195 lines)
**Purpose:** Monthly overview card, time-in-range bar, 30-day line chart, PDF export.
**Key IDs:** `#report-avg-glucose`, `#report-est-a1c`, `#monthlyTrendChart`, `#btn-export-pdf`
**External libs (CDN):** `chart.js`, `html2pdf.js` (load before `reports.js`).
**Scripts:** `i18n.js` (classic), then CDN libs, then `reports.js` (module), then `script.js` (module).
**Gotchas:**
- Time-in-range percentage bars (`#report-normal-pct`, `#report-high-pct`, `#report-low-pct` and corresponding `-bar` elements) are **referenced in `reports.js:197-204` but do not exist in the HTML** — the static bars in HTML use inline width styles. Stats will silently fail to update.

### 3.5 `front/log in/settings.html` (188 lines)
**Purpose:** Profile, preferences (lang/theme), security (password change).
**Key IDs:** `#settings-fname`, `#settings-email` (disabled), `#settings-diabetes-type`, `#settings-lang`, `#settings-theme`, `#settings-password`, `#btn-update-profile`, `#btn-change-password`
**Scripts:** `i18n.js`, then `settings.js`, then `script.js` (module).
**Gotcha:** Password change is a stub — it now shows a toast notification via `window.showToast()`. See Tech Debt §11.

### 3.6 `front/log in/script.js` (386→722 lines) — **CORE FILE**
**Type:** ES module (loaded with `type="module"`).
**Firebase config:** hardcoded at `script.js:5-13`. Treat as a public identifier.
**Exports / globals it creates:**
- `window.DiaCareDB` — facade for the data layer. Methods:
  - `init()` — bootstraps the 3 LocalStorage tables if missing
  - `addLog(table, data)` — push to `localStorage[table]` + mirror to Firestore subcollection `users/{uid}/{table}` (auto-stamps `timestamp` as ISO string)
  - `getLogs(table)` — read LocalStorage array
  - `syncLogs(table)` — pull Firestore subcollection → LocalStorage (last-write-wins by array replace)
  - `updateProfile(fname, type)` — `setDoc(..., { merge: true })` against `users/{uid}`
  - `logout()` — `signOut(auth)` + clear all diacare-related LocalStorage keys
- `window.switchTab(tab)` — toggles login/signup forms
- `window.showToast(msg, type)` — renders a toast notification (`'success'`, `'error'`, or `'info'`); auto-dismisses after 4s
- `window.chatBotAttached` — guard flag for the chatbot listener

**Auth flow:** `onAuthStateChanged` is the source of truth. On login it reads `users/{uid}` doc and writes `diacare_user_fname` + `diacare_diabetes_type` to LocalStorage, then calls `syncLogs` for all 3 tables, then dispatches `logsSynced` event (which `reports.js` listens for).
**Dashboard wiring:** the `DOMContentLoaded` block in `script.js` also handles global logout for all pages (`#logout-btn`), and on `dashboard.html` it sets up glucose/weight logging, theme toggle, user greeting, and a **full duplicate of the chatbot** (~280 lines).
**Custom events dispatched:**
- `userDataLoaded` — after `users/{uid}` doc is read on auth
- `logsSynced` — after each `syncLogs()` call
- `languageChanged` — dispatched by `i18n.js`

### 3.7 `front/log in/server.js` (34 lines)
**Purpose:** Stub Express server. One route, no middleware beyond `cors()` and `express.json()`.
**Route:** `POST /api/ai` — proxies the JSON body verbatim to `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}` and returns the response.
**Listen port:** 3000.
**Status:** The `GEMINI_API_KEY` constant holds an **Arabic placeholder string** that says "put your new key here after deleting the old one from Google". Real integration is incomplete (see §13). No frontend code currently calls `/api/ai` — it exists for a future Gemini-powered chatbot that will replace the local rule-based one.

### 3.8 `front/log in/i18n.js` (230 lines)
**Type:** Classic script (no `import`/`export`).
**Globals:** `dictionary` (const), `applyTranslations(lang)`, `updateLanguage(lang)`.
**Translation mechanism:** attributes `data-i18n` (text), `data-i18n-placeholder` (input), `data-i18n-title` (tooltip), `data-i18n-opt` (option text).
**RTL/LTR:** `updateLanguage('ar')` sets `<html dir="rtl" lang="ar">`. CSS uses `[dir="rtl"]` selectors to flip margins, padding, font-family.
**On load:** reads `diacare_lang` (default `en`) and applies translations.
**Custom event:** dispatches `languageChanged` after each language switch. Other pages listen to it to re-render dynamic text.
**Font swap:** in RTL mode the body uses `'Cairo'` first; in LTR it uses `'Inter'`.
**Gotcha:** The dictionary has 100+ keys but is **not exhaustive** — some English strings are inlined in HTML or in JS-generated DOM. Always check for an `i18n` attribute before assuming a key exists.

### 3.9 `front/log in/nutrition.js` (414 lines)
**Type:** Classic script.
**Responsibilities:**
- Theme + language toggle (duplicated, see §11)
- `renderDietPlan()` — reads `diacare_diabetes_type`, selects from the `plans` object (4 types × 4 meals each), injects HTML into `#personalized-diet-plan`. Plans are inline as bilingual HTML lists.
- `#diet-plan-selector` change handler — re-renders.
- `#print-diet-btn` handler — replaces `document.body.innerHTML` with a clean print version, calls `window.print()`, then restores + `location.reload()`. **This nukes all JS event handlers** until reload.
- A **complete duplicate of the chatbot** logic (appendMessage, loadChatHistory, typing indicator, handleChatSubmit). The nutrition page's chatbot is slightly more capable (knows about pizza-effect).
- Logout handler.
**State:** `window.selectedDietType` persists user's current selection across re-renders.

### 3.10 `front/log in/reports.js` (~345 lines)
**Type:** ES module (`type="module"`). Imports `{ auth, db }` from `firebase-config.js` and saves daily report summaries (`users/{uid}/reports/{date}`) to Firestore.
**Responsibilities:**
- Theme + language toggle (duplicated)
- Greeting text (duplicated)
- Chatbot (duplicated; identical to script.js)
- `renderReportsData()` — reads `db_glucose` from LocalStorage, computes:
  - Average glucose
  - **Estimated A1C** = `((avg + 46.7) / 28.7).toFixed(1)` (DCCT/ADAG approximation)
  - Time-in-range percentages (`<70`, `70–180`, `>180`)
  - 30 most recent readings → Chart.js line chart with red point markers for out-of-range
- PDF export via `html2pdf()` — clones `.main-content`, removes header/controls/export card, converts chart canvas to data-URL image, generates A4 PDF named `DiaCare_Report_YYYY-MM-DD.pdf`.
- Listens to `languageChanged`, `logsSynced`, `userDataLoaded` to re-render.

### 3.11 `front/log in/settings.js` (212 lines)
**Type:** Classic script.
**Responsibilities:**
- Theme + language toggle (duplicated; theme select change reuses the toggle button click)
- Initial form value population from LocalStorage
- `#btn-update-profile` — saves fname + diabetes type to LocalStorage, calls `DiaCareDB.updateProfile(...)` (which writes to Firestore)
- `#settings-lang` change → `updateLanguage(value)` (re-uses `i18n.js` function)
- `#settings-theme` change → simulates click on `#theme-toggle`
- `#btn-change-password` — **stub** that shows a toast via `window.showToast()`
- Greeting text
- Chatbot (duplicated)

### 3.12 `front/log in/styles.css` (1072→1443 lines)
**Structure (top-down):**
- `:root` CSS variables (light theme palette)
- `[data-theme="dark"]` overrides
- `[dir="rtl"]` overrides (margins, radii)
- Global reset + typography
- Login layout (`.container`, `.info-section`, `.form-section`, `.tabs`, `.form-active/hidden`)
- `.health-banner` (smart alert) + `.btn-explain-ai`
- Forms, inputs, buttons (`.btn-primary`, `.btn-secondary`)
- Dashboard layout (`.dashboard-container`, `.sidebar`, `.sidebar-nav`, `.user-type-selector`)
- Cards (`.card`, `.blood-sugar-card`, `.weight-card`, `.meal-tracker-card`, `.bolus-calculator-card`, `.suggestion-card`, `.chart-card`)
- `.glucose-input-wrapper` (input + button pair)
- `.meal-calculations`, `.calc-item`, `.calc-label`, `.calc-value`
- `.progress-container`, `.progress-bar`
- `.status-badge-container`, `.badge`, `.badge-default`
- `.chatbot-widget`, `.chatbot-btn`, `.chatbot-window`, `.chat-header`, `.chat-messages`, `.message.msg-user/msg-ai`, `.typing-indicator`, `.typing-dot`
- `.toast-container`, `.toast`, `.toast.is-success/error/info` + `@keyframes toastIn` (global toast/snackbar system)
- `@keyframes fadeIn`, `flashRedAlert`, `flashRedAlertDark` (dashboard injects these via inline `<style>` in its `<head>`)
- Responsive breakpoints at 992px and 640px

**Theming contract:** switching theme is a data-attribute swap, not a class swap. `[data-theme="dark"]` selector is the single source of dark styles.

---

## 4. Data Flow & Storage

### 4.1 Auth + Profile Flow
```
User submits login form
    └─→ signInWithEmailAndPassword(auth, email, password)
            └─→ getDoc(doc(db, "users", uid))   // reads { fname, type, email?, createdAt? }
                    ├─→ localStorage['diacare_user_fname']   = fname
                    ├─→ localStorage['diacare_user_email']   = email
                    └─→ localStorage['diacare_diabetes_type']= type
            └─→ DiaCareDB.syncLogs('db_glucose' | 'db_weight' | 'db_meals')
            └─→ window.location.href = 'dashboard.html'
```

`onAuthStateChanged` mirrors this on every auth state change (page reload, token refresh).

### 4.2 Logging Flow (e.g. glucose reading)
```
User types value, clicks #log-glucose-btn
    └─→ DiaCareDB.addLog('db_glucose', { value, context, type })
            ├─→ LocalStorage['db_glucose'].push({ ...payload, timestamp: ISO })
            └─→ addDoc(collection(db, "users/{uid}/db_glucose"), payload)
```

`db_meals` and `db_weight` work the same way. `db_meals` stores `{ mealName, carbs }`, `db_weight` stores `{ weight, height, bmi }`.

### 4.3 Logout Flow
```
Click #logout-btn
    └─→ DiaCareDB.logout()
            ├─→ signOut(auth)
            └─→ localStorage.removeItem(...)   // clears ALL diacare_* keys
    └─→ window.location.href = 'index.html'
```

### 4.4 LocalStorage Key Reference

| Key | Type | Written by | Read by |
|---|---|---|---|
| `diacare_user_fname` | string | `script.js` (login/signup), `settings.js` (update) | All pages (greeting) |
| `diacare_user_email` | string | `script.js` (login/signup) | Nowhere currently |
| `diacare_diabetes_type` | enum: `type1`\|`type2`\|`gestational`\|`pediatric` | `script.js`, `settings.js` | Dashboard thresholds, Nutrition plan, Chatbot branches |
| `diacare_lang` | `en`\|`ar` | `i18n.js` | `i18n.js`, `settings.js` |
| `diacare_theme` | `light`\|`dark` | All pages (toggle) | All pages |
| `diacare_last_glucose` | number | `dashboard.html` inline JS on input | Chatbot branches across 4 files |
| `diacare_daily_carbs` | number | `dashboard.html` inline JS on meal log | `dashboard.html` (display) |
| `diacare_daily_date` | string (toDateString) | `dashboard.html` inline JS | `dashboard.html` (rollover check) |
| `diacare_chat_history` | JSON array of `{text, sender}` | Chatbot in 4 files (only in **session**Storage) | Chatbot in 4 files |
| `db_glucose` | JSON array | `DiaCareDB.addLog`, `syncLogs` | `reports.js`, `dashboard.html` |
| `db_weight` | JSON array | `DiaCareDB.addLog`, `syncLogs` | Nowhere currently (collected but unused) |
| `db_meals` | JSON array | `DiaCareDB.addLog`, `syncLogs` | Nowhere currently |
| `pending_meal`, `pending_carbs` | string / number | (not currently written — feature placeholder) | `dashboard.html` (read on load) |
| `diacare_user_fname` (also in session? no) | — | — | — |

**Storage split:** `localStorage` for persistent state + `sessionStorage` for ephemeral chat history (cleared on browser close).

### 4.5 Firestore Schema

```
users (collection)
  └── {uid} (document)
        ├── fname: string
        ├── type: "type1" | "type2" | "gestational" | "pediatric"
        ├── email?: string
        └── createdAt?: ISO string

users/{uid}/db_glucose (subcollection)   // each doc: { value, context, type, timestamp }
users/{uid}/db_weight  (subcollection)   // each doc: { weight, height, bmi, timestamp }
users/{uid}/db_meals   (subcollection)   // each doc: { mealName, carbs, timestamp }
```

`timestamp` is set client-side in `DiaCareDB.addLog` as `new Date().toISOString()` (NOT a Firestore Timestamp).

### 4.6 Cross-Page Communication

Three custom `document`-scoped events:
- **`userDataLoaded`** — fired after `users/{uid}` is read on login
- **`logsSynced`** — fired after each `syncLogs()` call
- **`languageChanged`** — fired by `i18n.js` after `updateLanguage()`

`reports.js` listens to all three. `dashboard.html` inline JS listens to `languageChanged` to re-evaluate the dashboard.

---

## 5. i18n Contract

### 5.1 Translation Mechanism
The `dictionary` object in `i18n.js:1-156` is a flat map of `key → { en, ar }`. Pages tag their static text with attributes:

| Attribute | Applies to | Effect |
|---|---|---|
| `data-i18n="key"` | Any element with text | `applyTranslations` sets `textContent` to `dictionary[key][lang]`. Preserves a leading `<i>` icon if present. |
| `data-i18n-placeholder="key"` | `<input>`, `<textarea>` | Sets `placeholder` |
| `data-i18n-title="key"` | Any element | Sets `title` (tooltip) |
| `data-i18n-opt="key"` | `<option>` inside `<select>` | Sets `option.textContent` |

### 5.2 Adding a New Translation Key
1. Add `'yourKey': { en: 'English text', ar: 'النص العربي' }` to the `dictionary` object in `i18n.js`.
2. Add the attribute `data-i18n="yourKey"` (or variant) to the element in the relevant HTML page.
3. For dynamically injected HTML (e.g. `nutrition.js`'s `renderDietPlan`), you have two options:
   - Use bilingual conditionals in the JS: `isArabic ? 'النص' : 'Text'`
   - Use the `dictionary` object directly: `dictionary['yourKey'][isArabic ? 'ar' : 'en']`

### 5.3 RTL Rules
- `<html dir="rtl" lang="ar">` is set by `updateLanguage('ar')`.
- CSS overrides: `[dir="rtl"] body` swaps to `'Cairo'` font, `[dir="rtl"] .sidebar-nav .nav-item i` flips margin side, etc.
- Inline styles using `margin-right` / `padding-left` are **not** auto-flipped. New RTL-sensitive styles should use logical properties (`margin-inline-start`, etc.) or be guarded with `[dir="rtl"]` selectors.
- Sidebar logo, header, and form layouts are designed to flip cleanly.

### 5.4 Persistence
`updateLanguage` writes the chosen lang to `localStorage['diacare_lang']` and to `<html lang dir>`. Reloading the page restores it via the `DOMContentLoaded` handler at the bottom of `i18n.js`.

---

## 6. Diabetes Logic Reference

### 6.1 Glucose Status Thresholds

The dashboard computes a status from the current reading. Source: `dashboard.html` inline `updateDashboard()` (~lines 540-690).

| Type | Context | Lower | Upper |
|---|---|---|---|
| type1, type2 | fasting | 80 | 130 |
| type1, type2 | post-meal / random | 70 | 180 |
| pediatric | fasting | 90 | 130 |
| pediatric | post-meal / random | 110 | 180 |
| gestational | fasting | 70 | 95 |
| gestational | post-meal, 1h | 70 | 140 |
| gestational | post-meal, 2h | 70 | 120 |

Universal hard floor: `<70` is always "Low" regardless of type. (The implementation checks `< 70 || < lowerBound`.)

Status → visual:
- **Low** → red background `#fee2e2` + red text `#ef4444` + `flash-red-alert` animation
- **High** → red background + red text
- **Normal** → green background `#d1fae5` + green text `#10b981`

### 6.2 BMI Formula
```
heightM = heightCm / 100
bmi = weightKg / (heightM * heightM)
```
Displayed as `bmi.toFixed(1)`.

### 6.3 Estimated A1C
```
a1c = ((avgGlucose + 46.7) / 28.7).toFixed(1)   // percent
```
ADAG study approximation. Source: `reports.js:184`.

### 6.4 Meal Carb Impact (heuristic)
```
impact_mg_dL = carbs_g * 3
```
Used for "Estimated Blood Sugar Impact" display. Source: `dashboard.html:519, 745`.

### 6.5 Insulin Bolus Calculation
The bolus calculator in `dashboard.html` uses **fixed ratios** (not personalized):
- `target = 100` mg/dL (target glucose)
- `ISF = 50` (Insulin Sensitivity Factor — 1 unit drops BG by 50)
- `ICR = 10` (Insulin-to-Carb Ratio — 1 unit covers 10g carbs)

The bolus suggestion accounts for the current glucose deviation from target plus carbs. The implementation lives after `dashboard.html:1115` (the `setTimeout` in the `btn-analyze-ai` handler). Read it carefully before changing — it embeds type-specific adjustments and warnings.

### 6.6 Carb Lookup Table
~80 Arab / Middle-Eastern meals are inlined in `dashboard.html` `<datalist id="meal-datalist">`. Each `<option>` has `value` (Arabic + English name) and `data-carbs` (grams per serving). When the user types in `#meal-input` the JS matches against this datalist and pulls the carb count.

### 6.7 Smart Suggestion Logic
The `#suggestion-content` card shows 1 of 4 states based on glucose + weight vs. target:
- Glucose Low → "🚨 Low Blood Sugar: Follow 15-15 Rule" (animated red)
- Glucose High → "Attention (High): Drink water, take correction dose if prescribed"
- Glucose Normal → "Great Job!"
- Weight above target → adds "Nutritional Awareness" or "Pregnancy Note" subsection

All four suggestion strings are in `i18n.js` (`suggLowTitle`, `suggLowDesc`, `suggHighTitle`, etc.).

### 6.8 Health Banner
`#smart-health-banner` mirrors the glucose status with friendly copy from `i18n.js` keys `alertNormal`, `alertHigh`, `alertLow`. The "Explain with AI" button (`#banner-ai-btn`) injects a prompt into the chatbot input and triggers send.

---

## 7. Chatbot Knowledge

### 7.1 Architecture
A **local rule-based assistant** lives in 4 files (see Tech Debt §11). It does NOT call Gemini today — `server.js` exists for a future real integration.

### 7.2 Trigger Flow
```
User types in #chat-input and presses Enter (or clicks #chat-send)
    └─→ appendMessage(userText, 'user')                 // save to sessionStorage
    └─→ showTypingIndicator()                            // 3 animated dots
    └─→ setTimeout(600ms) →
            └─→ hideTypingIndicator()
            └─→ keyword match against userText.toLowerCase()
            └─→ appendMessage(response, 'ai')            // save to sessionStorage
```

### 7.3 Keyword Buckets (in evaluation order)

| Order | Keywords (lowercased) | Response topic |
|---|---|---|
| 1 | `رياض`, `sport`, `exercise` | Exercise advice (150 min/week aerobic, BG < 100 → snack, > 250 → avoid) |
| 2 | `أكل`, `طعام`, `eat`, `food`, `diet`, `كربوهيدرات` (dashboard only) | Diet focus: non-starchy veg, lean protein, complex carbs |
| 3 | `بيتزا`, `برجر`, `سريع`, `pizza`, `burger` (script.js + nutrition.js only) | "Pizza Effect" — delayed BG spike from fat-delayed carb digestion |
| 4 | numeric reading (matches `lastGlucose`) OR `قراءت` / `reading` / `سكر` / `جرعة` (dashboard) | Tailored advice using `lastGlucose` + `diabetesType` |
| 5 | fallback | Generic welcome |

### 7.4 Glucose-Specific Response Branches
Inside the "glucose query" branch, the response is type-specific:

- **Last reading < 70** (all types): Apply ADA "Rule of 15" (15g fast-acting carbs, wait 15 min, repeat). Universal message.
- **Last reading > 180**:
  - `type1` → drink water, rapid insulin correction, check ketones if >250, recheck in 2h
  - `type2` → confirm meds (Metformin 700mg example), water, light 15-20min walk, avoid simple carbs
  - `gestational` → water, strict diet, 15-min post-meal walks, consult doctor
  - `pediatric`/other → water, careful correction dose, no extra sweets
- **Last reading 70–180**: "Excellent! Keep it up" encouragement.

### 7.5 Response Footnote
Every AI response is suffixed with a disclaimer: "These are reference guidelines, always consult your treating doctor." The text is bilingual.

### 7.6 Session Persistence
Chat history is stored in `sessionStorage['diacare_chat_history']` as `[{text, sender}, ...]`. On page load, the default welcome message is replaced by the saved history. History is **not** synced to Firestore and is lost on browser close.

### 7.7 Chatbot Listener Guard
`window.chatBotAttached = true` is set in `script.js` early in the listener block. Subsequent pages that include `script.js` (which is most of them) check this flag and skip re-binding. This is the only known mechanism that prevents the listener from being attached twice when `script.js` is loaded after a page-specific script.

---

## 8. Theming & RTL

### 8.1 CSS Variables (light theme, `styles.css:1-14`)
```css
--primary-color:   #6a3ec4   /* purple */
--primary-light:   #9f6ae0
--primary-dark:    #6325ba
--secondary-color: #ad6bc0
--background:      #c3b2d7
--surface:         #ffffff
--input-bg:        #f8fafc
--text-main:       #1b0f2a
--text-muted:      #70648b
--border:          #e2e8f0
--error:           #8452d3
--success:         #10b981
```

### 8.2 Dark Theme Overrides (`styles.css:16-32`)
Activated by `<html data-theme="dark">`. Most variables are remapped; the palette shifts to deep navy/purple (`#1a1a2e` background, `#16213e` surface).

### 8.3 Theme Toggle Pattern
1. **Read saved:** `localStorage.getItem('diacare_theme')` is read in an **inline `<script>` in `<head>` of every page** — this prevents FOUC by setting the data attribute before paint.
2. **Toggle:** `#theme-toggle` click handler swaps the data attribute and persists to LocalStorage.
3. **Icon swap:** `#theme-icon` `<i>` class changes between `fa-moon` and `fa-sun`.

The toggle logic is **duplicated in 4 files** (`script.js`, `nutrition.js`, `reports.js`, `settings.js`). All four must stay in sync.

### 8.4 RTL Overrides
- `[dir="rtl"]` selector swaps `body` font to `'Cairo'`
- `[dir="rtl"] .sidebar-nav .nav-item i` flips icon margin from right to left
- `[dir="rtl"] .calc-item` changes alignment to flex-start
- `[dir="rtl"] .glucose-input-wrapper input` flips border-radius corners

**Note:** Not all layout is RTL-perfect. Anything you add with explicit `margin-left`/`margin-right` or `left`/`right` properties will NOT auto-flip. Prefer `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, etc.

---

## 9. Conventions & House Rules

### 9.1 File & Folder Naming
- The app folder is literally `front/log in/` (with a space). **Do not rename it** — every internal link, relative path, and script src would break.
- All filenames are lowercase: `index.html`, `script.js`, etc.

### 9.2 Code Style
- **4-space indentation** in HTML and JS
- **2-space indentation** in CSS
- **Single quotes** for JS strings; double quotes for HTML attributes
- **No semicolons missing** in JS — `script.js` and friends use ASI-friendly style but semicolons are present at end of statements
- **No build step / no bundler / no transpiler** — code is shipped as-is
- **ES Modules:** only `script.js` is loaded with `type="module"`. Other JS files are classic scripts that pollute `window.*` deliberately.
- **Comments:** sparse. Add new comments only when necessary for non-obvious logic.
- **No emoji** in code unless they were already there (the chatbot uses them as semantic markers for severity).

### 9.3 HTML Conventions
- Every page shares the same `<head>` skeleton (title, description, FontAwesome, Google Fonts, inline FOUC-prevention script for theme).
- Sidebar markup is **duplicated verbatim** across `dashboard.html`, `nutrition.html`, `reports.html`, `settings.html`. If you change the sidebar, change it in all four files.
- Chatbot widget markup is **also duplicated** across all 5 pages (including `index.html`).
- Translatable strings use `data-i18n*` attributes. Plain English strings (e.g. terms-of-service link text) are accepted if not user-facing.
- Inline `style="..."` is common for one-off positioning — this is an existing pattern, match it for consistency.

### 9.4 JavaScript Conventions
- Globals are namespaced under `window.DiaCareDB`, `window.switchTab`, `window.chatBotAttached`, `window.selectedDietType`, `window.dictionary`, `window.applyTranslations`, `window.updateLanguage`.
- Chatbot code in 4 files is **intentionally duplicated** (not imported). Do not "DRY this up" by extracting to a shared file unless you're also changing the loading order in all 4 HTML pages.
- `setTimeout(..., 600)` simulates AI latency in the chatbot. Keep it consistent.

### 9.5 Firebase Conventions
- All Firestore paths go through the `users/{uid}/...` pattern. Do not create top-level collections.
- The Firebase config is hardcoded in `script.js:5-13`. Don't try to "externalize" it without coordinating with §13.

### 9.6 Git
- Repo is a git repo (`.git/` present).
- A `.vscode/settings.json` exists setting Live Server port to 5501.
- No `.gitignore` is checked in, but `node_modules/` is conventionally ignored. Don't commit `node_modules/`.

---

## 10. Common Tasks / Recipes

### 10.1 Add a New Page
1. Create `front/log in/newpage.html`.
2. Copy the `<head>` and sidebar block from `dashboard.html`.
3. Add a `class="nav-item"` link to the sidebar in **all four** existing dashboard-style pages (and the new one).
4. Add new `data-i18n` keys to `i18n.js` for the page title and any new UI strings.
5. If the page needs the chatbot: copy the chatbot widget HTML and the chatbot JS block from `nutrition.js` (or `settings.js`).
6. Load scripts in this order: `i18n.js`, your page JS (classic), `<script type="module" src="script.js">`.
7. If the page needs a logout button: add `<a href="#" id="logout-btn">` and rely on the global handler in `script.js`.

### 10.2 Add a New Language
1. Add a third entry to every key in `dictionary` (e.g. `fr`).
2. Add CSS overrides in `[dir="ltr"]` (or a new `[dir="newlang"]` selector) for any layout-specific quirks.
3. In `i18n.js`, add the language to `updateLanguage` (default fallback) and to the toggle button cycling logic.
4. Set `<html lang="newlang">` instead of `dir="rtl"` for non-RTL languages.
5. Load a suitable web font in the Google Fonts `<link>` in every HTML page.

### 10.3 Add a New Meal to the Carbs Database
1. In `dashboard.html`, find `<datalist id="meal-datalist">`.
2. Add a new `<option value="Arabic name / English name" data-carbs="X"></option>` at the appropriate category (مخبوزات، فطور، حلويات، إلخ).
3. The carb value is grams per serving. The estimated BG impact is automatically `carbs × 3 mg/dL`.
4. For English-only entries, omit the Arabic name from the value.

### 10.4 Wire a New Firestore Field
1. Add a `setDoc` (or `updateDoc`) call inside `DiaCareDB` methods — do not write to Firestore from page-level scripts.
2. Add the LocalStorage mirror in the same call.
3. If the data is per-record (e.g. a "notes" field on a glucose reading), add the key to the `data` object passed to `addLog(table, data)` — it will be persisted to both LocalStorage and Firestore automatically.
4. If the data is per-user (like `fname` / `type`), add a new method on `DiaCareDB` (e.g. `updateSettings(...)`).
5. Update `onAuthStateChanged` in `script.js` to read the new field and write it to LocalStorage.
6. Update `syncLogs` callers if the data lives in a new subcollection.

### 10.5 Fix or Extend the Chatbot
1. **Identify the response surface** — the chatbot is duplicated in 4 files: `script.js` (full), `nutrition.js` (full, has pizza-effect), `reports.js` (full), `settings.js` (full).
2. **Search for the keyword or branch** in all 4 files. They must stay identical (or as close as possible) for consistent UX.
3. If adding a new keyword bucket, **insert it in evaluation order** (current order: exercise → food → pizza → glucose query → fallback). Keep the order to avoid shadowing.
4. For bilingual responses, use the `isArabic` ternary pattern that all 4 files use.
5. The `setTimeout(600ms)` simulates latency. If you change it, change it in all 4 files.

### 10.6 Change the Glucose Thresholds
1. Edit `dashboard.html` inline `updateDashboard()` — the threshold `if/else` block (~lines 613-640).
2. Update `i18n.js` `suggLowTitle` / `suggLowDesc` / `suggHighTitle` / `suggHighDesc` if the message text should change.
3. Update the chatbot's glucose branch in all 4 JS files if the response text references the threshold values.
4. Consider whether `reports.js` time-in-range bands (`<70`, `70–180`, `>180`) should also change.

### 10.7 Connect the Chatbot to Real Gemini
1. Get a Gemini API key.
2. Replace the `GEMINI_API_KEY` constant in `server.js` with the real key (or load from `process.env.GEMINI_API_KEY`).
3. In each chatbot's `handleChatSubmit`, replace the local `setTimeout` keyword match with a `fetch('/api/ai', { method: 'POST', body: JSON.stringify({ contents: [...] }) })` and parse the response.
4. Test CORS — the backend already enables CORS for all origins (`app.use(cors())`).
5. Consider adding a loading state and error handling.

---

## 11. Known Issues / Tech Debt

| # | Issue | Location | Severity | Suggested action |
|---|---|---|---|---|
| 1 | **Chatbot logic duplicated 4×** in `script.js`, `nutrition.js`, `reports.js`, `settings.js` (~280 lines each, ~1120 total). | All 4 JS files | Medium | Extract to `chatbot.js` loaded as classic script, expose `window.DiaCareChat` API. |
| 2 | **Firebase config hardcoded** in client-side JS. | `script.js:5-13` | High (security) | Move to environment variable consumed at build time, or use Firebase App Check. |
| 3 | **Gemini API key is a placeholder** (Arabic text "put your new key here..."). | `server.js:10` | High | See recipe §10.7. Also: don't commit a real key. |
| 4 | **Auto-redirect commented out** in `script.js:142-150`. Authenticated users must manually navigate to dashboard. | `script.js:142-150` | Low | Re-enable with a guard for `/index.html` only. |
| 5 | **`dailyBgChart` canvas exists** in `dashboard.html` but `renderDailyChart()` is never defined. | `dashboard.html:455`, all JS files | Medium | Either implement the function or remove the canvas and chart card. |
| 6 | **`#user-physio-context` and `#meal-search-input`** are referenced in `dashboard.html` inline JS but not in the DOM. | `dashboard.html:491, 499` | Low | Remove references or add the missing elements. |
| 7 | **Password change is a stub** — shows a toast (was `alert()` before toast migration). | `settings.js:98-105` | Medium | Wire to Firebase Auth `updatePassword(currentUser, newPassword)`. Requires re-auth. |
| 8 | **Time-in-range bars** in `reports.js:197-204` reference IDs that don't exist in `reports.html`. | `reports.js:197-204`, `reports.html:104-134` | Low | Either add the IDs or rewrite to update the existing inline-style bars. |
| 9 | **`physioContextSelect` fallback to `'none'`** is dead code — selector never exists. | `dashboard.html:551` | Low | Clean up. |
| 10 | **Two `<span data-i18n>` button labels** in `#btn-analyze-ai` both render. | `dashboard.html:435-436` | Low | Remove the `calculateDose` one (looks like a leftover from a rename). |
| 11 | **Meal database uses only one language at a time** — when language is EN, the Arabic name in the option value is still shown in the dropdown. | `dashboard.html:268-393` | Cosmetic | Filter options by language or split into two datalists. |
| 12 | **`pending_meal` / `pending_carbs` LocalStorage keys** are read but never written. | `dashboard.html:512-534` | Low | Either remove or implement (e.g. when user clicks a meal in Nutrition Library). |
| 13 | **Theme toggle icon and handler** duplicated in 4 files plus inline scripts in HTML pages. | All pages | Low | Extract to a small `theme.js` helper. |
| 14 | **Sidebar and chatbot widget HTML** duplicated across 5 HTML pages. | All `*.html` | Low | Without a build step, options are: (a) leave it, (b) inject via JS, (c) move to a tiny SSG. |
| 15 | **No tests.** | — | Medium | Add at least smoke tests for the threshold logic and chatbot keyword routing. |
| 16 | **`db_weight` and `db_meals` are written but never read** by any page (only `db_glucose` is consumed in `reports.js`). | `script.js`, `reports.js` | Low | Surface them in `reports.html` (weight trend, meal breakdown) or stop writing. |
| 17 | **`firebaseConfig` is the only auth config** — no Firebase App Check, no rate limiting. | `script.js:5-13` | High (security) | Enable App Check before going to production. |
| 18 | **`sessionStorage` chat history** is not bounded — can grow indefinitely. | All 4 chatbot blocks | Low | Cap to last 50 messages. |
| 19 | **`onAuthStateChanged` race condition:** if the page loads faster than Firestore, `diacare_user_fname` may be missing on first paint. | `script.js:94-108` | Low | Add a fallback display ("Welcome, User!"). |
| 20 | **Print handler in `nutrition.js`** nukes `document.body.innerHTML` and reloads — fragile, can break in iframes or with browser extensions. | `nutrition.js:235-253` | Medium | Use `@media print` CSS to hide chrome instead. |

---

## 12. Do-Not-Break List

### 12.1 Element IDs the Code Depends On

**Dashboard (`dashboard.html`):**
`#user-diabetes-type`, `#measurement-context`, `#gestational-time-group`, `#gestational-time`, `#glucose-input`, `#log-glucose-btn`, `#glucose-badge`, `#height-input`, `#target-weight-input`, `#weight-input`, `#log-weight-btn`, `#calc-bmi`, `#weight-diff`, `#weight-progress`, `#meal-input`, `#meal-datalist`, `#log-meal-btn`, `#calc-carbs`, `#calc-impact`, `#bolusCarbsInput`, `#calc-bolus-dose`, `#btn-analyze-ai`, `#suggestion-content`, `#smart-health-banner`, `#banner-icon`, `#banner-message`, `#banner-ai-btn`, `#dailyBgChart`, `#user-greeting`, `#logout-btn`, `#theme-toggle`, `#theme-icon`, `#lang-toggle`

**Reports (`reports.html`):**
`#report-avg-glucose`, `#report-est-a1c`, `#monthlyTrendChart`, `#btn-export-pdf`

**Settings (`settings.html`):**
`#settings-fname`, `#settings-email`, `#settings-diabetes-type`, `#settings-lang`, `#settings-theme`, `#settings-password`, `#btn-update-profile`, `#btn-change-password`

**Nutrition (`nutrition.html`):**
`#personalized-diet-plan`, `#diet-plan-selector` (dynamic), `#print-diet-btn` (dynamic)

**Index (`index.html`):**
`#form-login`, `#form-signup`, `#tab-login`, `#tab-signup`, `#login-email`, `#login-password`, `#signup-fname`, `#signup-lname`, `#signup-email`, `#signup-password`, `#signup-dob`, `#signup-type`

**Global (every page):**
`#chatbot-toggle`, `#chatbot-window`, `#chatbot-close`, `#chat-messages`, `#chat-input`, `#chat-send`, `#logout-btn` (in sidebar pages), `#theme-toggle`, `#theme-icon`, `#lang-toggle`, `#user-greeting`

### 12.2 localStorage Keys (See §4.4 for full table)
Critical: `diacare_user_fname`, `diacare_diabetes_type`, `diacare_lang`, `diacare_theme`, `diacare_last_glucose`, `db_glucose`, `db_weight`, `db_meals`. Removing or renaming any of these requires a data migration.

### 12.3 CSS Class Hooks
`.dashboard-container`, `.dashboard-body`, `.sidebar`, `.sidebar-nav`, `.sidebar-logo`, `.user-type-selector`, `.main-content`, `.main-header`, `.header-logo`, `.header-controls`, `.user-profile`, `.card`, `.blood-sugar-card`, `.weight-card`, `.meal-tracker-card`, `.bolus-calculator-card`, `.suggestion-card`, `.chart-card`, `.glucose-input-wrapper`, `.meal-calculations`, `.calc-item`, `.calc-label`, `.calc-value`, `.status-badge-container`, `.badge`, `.badge-default`, `.progress-container`, `.progress-bar`, `.health-banner`, `.banner-content`, `.btn-explain-ai`, `.flash-red-alert`, `.toast-container`, `.toast`, `.toast.is-success`, `.toast.is-error`, `.toast.is-info`, `@keyframes toastIn`, `.chatbot-widget`, `.chatbot-btn`, `.chatbot-window`, `.chat-header`, `.close-chat`, `.chat-messages`, `.message.msg-user`, `.message.msg-ai`, `.chat-input-area`, `.chat-send-btn`, `.typing-indicator`, `.typing-dot`, `.info-section`, `.info-content`, `.background-decorations`, `.circle`, `.circle-1`, `.circle-2`, `.container`, `.form-section`, `.form-container`, `.tabs`, `.tab.active`, `.form-active`, `.form-hidden`, `.input-group`, `.row`, `.btn-primary`, `.btn-secondary`, `.terms`, `.forgot-password`, `.checkbox-label`, `.form-options`, `.form-header`, `[data-theme="dark"]`, `[dir="rtl"]`

### 12.4 Globals
`window.DiaCareDB`, `window.DiaCareDB.init/addLog/getLogs/syncLogs/updateProfile/logout`, `window.switchTab`, `window.showToast`, `window.chatBotAttached`, `window.selectedDietType`, `window.dictionary`, `window.applyTranslations`, `window.updateLanguage`, `window.updateDashboard` (referenced by `i18n.js` and `dashboard.html`)

### 12.5 Custom Events
`userDataLoaded`, `logsSynced`, `languageChanged`

### 12.6 Diabetes Type Values
The valid values are exactly: `"type1"`, `"type2"`, `"gestational"`, `"pediatric"`. Adding a new type requires updates in: `i18n.js` (option labels), `dashboard.html` (select options + threshold logic), `nutrition.js` (diet plan + selector), `script.js` (chatbot branches), `reports.js` (if statistics should split by type).

### 12.7 Diabetes Type vs. Context Defaults
The default value for `diacare_diabetes_type` is `"type1"` (used as fallback throughout). The default for `diacare_lang` is `"en"`. The default for `diacare_theme` is `"light"`. Don't change these defaults without auditing all fallback paths.

---

## 13. Security Notes

### 13.1 Hardcoded Firebase Config (`script.js:5-13`)
The Firebase web config (apiKey, authDomain, projectId, etc.) is committed in `script.js`. **This is expected for client-side Firebase apps** — Firebase API keys are not secret, they identify the project for billing/quotas. The actual security boundary is Firebase Security Rules on Firestore + Firebase Auth, neither of which is visible in this repo.

**Action items before production:**
1. **Define and deploy Firestore Security Rules** — the current state (no rules) means anyone with the apiKey can read/write the entire `users` collection. Recommended starter:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{db}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
       match /users/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
2. **Enable Firebase App Check** to prevent abuse from non-app clients.
3. **Lock down the auth domain** in Firebase Console (Authentication → Settings).
4. **Rotate the API key** if you suspect leakage (Firebase lets you do this without downtime by deploying both keys during a transition window).

### 13.2 Gemini API Key Placeholder (`server.js:10`)
The `GEMINI_API_KEY` constant contains an Arabic note asking the developer to paste a real key. **Do not commit a real key.** Instead, load it from an environment variable:
```js
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set. The /api/ai route will fail.');
}
```
And document `.env` usage in a `.env.example` (or update `package.json` with `dotenv` and add a `README` if you create one).

### 13.3 HTTPS / Mixed Content
- All CDN assets are HTTPS (FontAwesome, Google Fonts, gstatic Firebase, jsdelivr Chart.js, cdnjs html2pdf). No mixed-content issues.
- The backend (`http://localhost:3000`) will need to be HTTPS in production or it will be blocked by browsers when the page is served over HTTPS.

### 13.4 CORS
`server.js` calls `app.use(cors())` with default options — open to all origins. Restrict in production:
```js
app.use(cors({ origin: 'https://your-diacare-domain.com' }));
```

### 13.5 User Data in LocalStorage
Glucose, weight, and meal logs are mirrored to `localStorage` in plaintext. On a shared/public device, anyone with browser access can read them. Add a "lock app" feature or document this caveat.

### 13.6 Password Storage
`script.js:234` explicitly notes: "Passwords are not stored locally for security". Verified — no password is written to LocalStorage or sessionStorage. Good.

---

## 14. Quick Reference

| Need to... | Look in |
|---|---|
| Add a new English/Arabic string | `i18n.js` dictionary |
| Change glucose status colors | `dashboard.html` `updateDashboard()` and `styles.css` |
| Change a diabetes threshold | `dashboard.html` `updateDashboard()` lines ~613-640 |
| Add a new meal | `dashboard.html` `<datalist id="meal-datalist">` |
| Add a new diabetes type | `i18n.js` + `dashboard.html` + `nutrition.js` (3 places) + chatbot branches (4 files) |
| Change the brand color | `styles.css` `--primary-color` and `--primary-dark` |
| Wire Firebase | `script.js` `DiaCareDB` facade |
| Add a chart | `reports.js` (Chart.js) — see existing `monthlyTrendChart` |
| Export a new PDF | `reports.js` `btn-export-pdf` handler (html2pdf.js) |
| Fix the chatbot | All 4 JS files (must stay in sync) |
| Run locally | VS Code → Right-click `index.html` → Open with Live Server (port 5501) |
| Run backend | `cd "C:\Users\DELL\Desktop\project_final\DiaCare-Project" && npm install && node "front/log in/server.js"` |

---

*Last updated: 2026-06-06. If the project structure changes, update sections §2 (Directory Map), §3 (Key Files), and §12 (Do-Not-Break List) at minimum.*
