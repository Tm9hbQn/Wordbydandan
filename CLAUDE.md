# Wordbydandan - Claude Code Project Guide

> **Self-Maintenance Rule:** After EVERY task, update this file and IMPROVEMENTS.md if anything changed — new features, bug fixes, removed code, new gotchas, changed line numbers, updated file sizes, new constants, etc. This keeps future sessions accurate. Increment cache busters in index.html whenever JS/CSS files change.

## Quick Context

**What:** "המילים הראשונות של דניאלה" — A Hebrew RTL baby word tracker documenting first words with age, notes, and pronunciation evolution chains.

| Key | Value |
|-----|-------|
| Live site | GitHub Pages (auto-deploys from `main`) |
| Repo | `Tm9hbQn/Wordbydandan` |
| Language | Hebrew, full RTL (`dir="rtl"` on `<html>`) |
| `BABY_NAME` | `"דניאלה"` (app.js line 4) |
| `BABY_BIRTHDAY` | `new Date(2024, 11, 5)` — Dec 5, 2024 (app.js line 3) |
| `BABY_MAX_AGE` | 16 months (vocab-charts.js) |

## Tech Stack

- **Frontend:** Vanilla HTML + CSS + JS — no build step, no framework
- **PWA:** Progressive Web App — installable, offline support, push notifications
- **Database:** Supabase (PostgreSQL) with automatic localStorage fallback
- **Realtime:** Supabase Realtime for cross-device sync
- **Fonts:** Google Fonts — Secular One (headings), Varela Round (body), Karantina (word display), Suez One (minimal use)
- **Icons:** Lucide Icons v0.344.0 (CDN)
- **Hosting:** GitHub Pages

## File Map

```
/
├── index.html              # Single-page app (~430 lines)
├── quick-add.html          # PWA shortcut — minimal word add page
├── install.html            # Download/install page for PWA and widget
├── manifest.webmanifest    # PWA manifest — app name, icons, shortcuts, display mode
├── sw.js                   # Service Worker — caching, offline, push notifications
├── version.json            # Remote version check — triggers update modal in app
├── CLAUDE.md               # THIS FILE — read before every task
├── IMPROVEMENTS.md         # 20/80 optimization roadmap
├── css/
│   ├── styles.css          # All main styles (~3280 lines)
├── js/
│   ├── app.js              # Main app logic + PWA module (~3620 lines)
│   ├── acquisition-analysis.js # Acquisition analysis engine, module pattern (~525 lines)
│   ├── vocab-charts.js     # Vocabulary analysis charts, IIFE pattern (~726 lines)
├── icons/
│   ├── icon-192x192.png    # PWA icon 192x192
│   ├── icon-512x512.png    # PWA icon 512x512
│   └── generate-icons.js   # Script to regenerate icons
└── supabase/
    ├── schema.sql          # DB schema with RLS policies
    ├── push-schema.sql     # Push notification subscriptions table + Realtime enable
    └── functions/
        └── notify-new-word/
            └── index.ts    # Edge Function for push notifications
├── android-widget/             # Native Android widget companion app
│   ├── app/src/main/
│   │   ├── kotlin/com/dandan/wordwidget/
│   │   │   ├── AddWordActivity.kt    # Dialog-style quick add
│   │   │   ├── WordWidgetProvider.kt  # Widget provider
│   │   │   ├── SupabaseApi.kt         # REST API calls
│   │   │   └── LauncherActivity.kt    # Opens PWA in browser
│   │   ├── res/                        # Layouts, drawables, values
│   │   └── AndroidManifest.xml
│   ├── app/build.gradle.kts
│   ├── build.gradle.kts
│   ├── settings.gradle.kts
│   └── release.keystore        # Persistent APK signing key (committed)
└── .github/workflows/
    ├── deploy.yml              # GitHub Pages deployment
    └── build-widget.yml        # Android widget APK build
```

## Loading Order & Dependencies

Understanding this prevents 90% of "it doesn't work" issues:

```
1. Google Fonts (preconnect + stylesheet)
2. css/styles.css?v=21          ← all visual styles
3. PWA manifest + meta tags     ← manifest.webmanifest, theme-color, apple-mobile-web-app
4. HTML body renders
5. Supabase JS SDK (CDN)        ← must load before app.js
6. Lucide Icons (CDN)           ← must load before app.js calls lucide.createIcons()
7. js/app.js?v=23               ← main logic + PWA module, runs on DOMContentLoaded
7b. js/acquisition-analysis.js?v=3 ← acquisition analysis engine (module)
8. js/vocab-charts.js?v=14      ← chart IIFE, exposes VocabCharts.render(), called by app.js
9. Service Worker (sw.js)       ← registered by app.js initPWA(), runs in background thread
```

**Critical:** `app.js` depends on `window.supabase` (SDK) and `lucide` (icons) being available. `vocab-charts.js` exposes `window.VocabCharts.render(words)` and is called by `app.js` after loading words from DB. The service worker is registered asynchronously and doesn't block loading.

## Architecture Overview

### Data Flow

```
User Input → submitWord() → duplicate check → age picker → notes → saveNewWord()
                                                                        ↓
                                                              insertWord() → Supabase
                                                                        ↓ (fallback)
                                                                   localStorage
                                                                        ↓
                                                              loadWords() → fetchWords()
                                                                        ↓
                                                              global `words` array
                                                                        ↓
                                                    renderWords() → Grid OR Timeline
                                                    renderTrends() → SVG charts
```

### State Variables (app.js globals)

| Variable | Type | Purpose |
|----------|------|---------|
| `words` | Array | All word objects from DB |
| `currentView` | `'grid'\|'timeline'` | Active display mode |
| `currentWord` | String | Word being added (during add flow) |
| `currentAgeMonths` | Number\|null | Selected age during add flow |
| `editingWordId` | String\|null | ID of word being edited |
| `viewingWord` | Object\|null | Word shown in view modal |
| `searchQuery` | String | Current search filter |
| `viewBeforeSearch` | String\|null | View to restore after search clears |
| `timelineDisplayCount` | Number | Timeline pagination (resets to 10 on re-render) |
| `addFlowLinkedTo` | String\|null | Linked word ID during add flow |
| `editingLinkedTo` | String\|null | Linked word ID during edit |
| `submitting` | Boolean | Prevents duplicate submissions |
| `filterMonth` | Number\|null | Selected month filter (null = all) |
| `filterCategory` | String\|null | Selected CDI category filter (null = all) |
| `addFlowEvoSource` | Object\|null | Source word when adding evolution from view card |

### Database Schema

```sql
words {
  id:          UUID PRIMARY KEY
  word:        TEXT NOT NULL
  age_months:  INTEGER (nullable)
  notes:       TEXT (nullable)
  linked_to:   UUID (nullable, FK → words.id)  -- evolution chain parent
  created_at:  TIMESTAMPTZ
  updated_at:  TIMESTAMPTZ
}
```

Supabase anon key is public (RLS-protected). localStorage key: `'daniella_words'`.

### Dual Persistence

All DB operations follow this pattern:
1. Try Supabase query
2. On success: sync to localStorage as backup
3. On failure: fall back to localStorage operation
4. `db` global is null if SDK didn't load → pure localStorage mode

## Site Sections (DOM order)

| # | Section | Key IDs | Notes |
|---|---------|---------|-------|
| 1 | Header | `#main-header` | Gradient bg, baby emoji, א ב ג blocks |
| 2 | Floating BG | `#floating-elements` | 10 animated emoji, `aria-hidden`, z-index 0 |
| 3 | Input | `#inputSection`, `#wordInput`, `#addBtn` | Marker-style design, Karantina font |
| 4 | Age Picker | `#ageSection`, `#ageOptions` | Scroll-snap wheel, hidden until word submitted |
| 5 | Notes | `#notesSection`, `#notesInput` | Contenteditable, optional word linking |
| 6 | Success Toast | `#successOverlay` | Fixed bottom-left, 2s display, z-index 100 |
| 7 | Words Section | `#wordsSection` | Contains nav, search, grid, timeline |
| 7a | Section Nav | `#sectionNav` | Sticky, backdrop-blur, tabs + view toggle |
| 7b | Search | `#searchInput` | Auto-switches to grid, fuzzy matching |
| 7c | Filters | `#filtersBar` | Collapsible month/category filter toggles |
| 7d | Grid View | `#wordsGrid` | CSS grid, hidden by default |
| 7e | Timeline | `#timelineWrapper`, `#timelineTrack` | Default view, paginated (10→+50→all) |
| 8 | Trends | `#trendsSection` | Two tabs: לפי חודשים / לפי סדר רכישה |
| 8a | Growth Chart | `#trendsChart`, `#trendsSvg` | Cumulative line+area, interactive cursor |
| 8b | Delta Chart | `#deltaChart`, `#deltaSvg` | Bar chart, best month highlighted pink |
| 8c | Stat Card | `#trendsStatCard` | Shimmer animation, Lucide trending-up icon |
| 8d | Vocab Cards | `#vocabCards` | Populated by vocab-charts.js |
| 8e | Noun Bias | `#acqNounBiasCanvas` | Line chart: noun ratio over vocabulary growth |
| 8f | Rolling Mix | `#acqPulseCanvas` | Stacked bars per word window |
| 8g | Milestones | `#acqMilestonesCanvas` | Category composition at milestones |
| 8h | Acq Stat | `#acqStatCard` | Stat card for acquisition tab |
| 8i | Streaks | `#acqStreaksList` | Longest category streaks (>3 words), with word tags |
| 8j | Last Streak | `#acqLastStreakCard` | Stat card for the most recent streak |
| 8k | Insights | `#acqInsightsList` | Auto-generated textual insight cards |
| 9 | Edit Modal | `#editModal` | View/Edit/Add-evo toggle, z-index 200 |
| 10 | Evo Modal | `#evoModal` | Vertical chain with reorder, z-index 200 |
| 11 | Delete Modal | `#deleteConfirmModal` | Custom styled, NEVER use native confirm() |
| 12 | Install Banner | `#pwaInstallBanner` | PWA install prompt, fixed bottom, z-index 150 |
| 13 | Realtime Toast | `#realtimeToast` | Real-time new word notification, fixed top center, z-index 250 |
| 14 | Update Modal | `#updateModal` | Version check popup, mandatory blocks app, optional dismissable, z-index 200 |
| 15 | Footer | `.main-footer` | Copyright, export btn, install page link |

## Design System

### Color Palette (CSS Variables)

```css
--pink: #FFE5EC       --hot-pink: #FF6B9D
--peach: #FFF3E0      --teal: #4ECDC4
--mint: #E8F5E9       --yellow: #FFD93D
--baby-blue: #E3F2FD  --coral: #FF8A80
--lavender: #F3E5F5   --deep-purple: #2D1B69
--bg: #FFF9FB         --soft-purple: #6C5CE7
```

**Shadows:** `--card-shadow` (subtle), `--card-shadow-hover` (elevated)

### Typography

| Font | Usage | CSS Weight |
|------|-------|------------|
| Secular One | Headings, bold Hebrew | 400 |
| Varela Round | Body text, UI elements | 400 |
| Karantina | Word display (large, playful) | 300, 400, 700 |
| Suez One | Minimal decorative use | 400 |

### Z-Index Layers

| Z | Layer |
|---|-------|
| 0 | Floating background elements |
| 1-2 | Age wheel components |
| 5 | Timeline connecting lines |
| 10 | Header, input, age sections |
| 20 | Sticky navbar |
| 50 | Input-focused overlay |
| 100 | Success toast |
| 200 | All modals (edit, evo, delete) |

### Key Animations (25 total in CSS)

Most important to understand:
- `floatUp` — background emoji floating
- `rainbowSlide` — input underline gradient
- `modalSlideUp` — modal entrance (0.4s cubic-bezier)
- `statShimmer` — stat card highlight shimmer (1.5s loop)
- `dotPulseTimeline` — timeline dot pulse
- Scroll-reveal system: `.reveal-on-scroll` + `.revealed` class + `--reveal-delay` CSS var

### Word Card Color System

**Categorized words** use their CDI category color (from `CDI_CAT_COLORS`) via `--card-accent` CSS variable:
- Grid cards: `.word-card-categorized` class → `::before` uses `var(--card-accent)`
- Timeline cards: `.timeline-card-categorized` class → border tint; dot background set inline

**Uncategorized words** fall back to 5-color rotation via `:nth-child(5n+X)`:
1. pink, 2. teal, 3. yellow, 4. purple, 5. coral

## RTL Rules (CRITICAL)

1. `dir="rtl"` on `<html>` — everything flows right-to-left
2. **All user-visible arrows must be `←`** (left-pointing = forward in RTL)
3. `join(' ← ')` in evolution chain text (grid cards, timeline cards, modal)
4. CSS `left`/`right` are VISUAL positions (not logical)
5. Modal close button: `top: 1rem; left: 1rem` (top-left = top-start in RTL)
6. Canvas charts: `textAlign: 'right'` for labels

**Verify:** `grep '→' js/app.js` must return ZERO hits in non-comment code.

## Evolution Chains

Words link via `linked_to` field forming directed graphs:

```
"בא" ← "פא פא" ← "אבא"  (each word's linked_to points to its predecessor)
```

- `getEvolutionChain(wordId)`: traces to root, builds forward chain sorted by age
- Reordering via `swapChainOrder()`: rebuilds all `linked_to` pointers in chain
- Display: horizontal in cards (`join(' ← ')`), vertical in evo modal (▼ arrows)
- **Word linking UI**: fuzzy search input (NOT dropdown/select), results above input

## Vocabulary Analysis (vocab-charts.js)

### CDI Categories (ACTUAL code taxonomy)

| Code Key | Hebrew Label | Color |
|----------|-------------|-------|
| `general_nominals` | שמות עצם כלליים | #6C5CE7 (purple) |
| `specific_nominals` | שמות עצם ספציפיים | #FF6B9D (pink) |
| `action_words` | מילות פעולה | #4DD0E1 (cyan) |
| `modifiers` | מתארים | #FFD93D (yellow) |
| `personal_social` | אינטראקציה וחברה | #CE93D8 (purple) |
| `unclear` | לא ברור | #B0BEC5 (gray, excluded from charts) |

**Sub-categories** (in DB `sub_category` column): people, sound_effects, animals, food_drink, body_parts, household, toys_and_routines, clothing, actions, routines_and_games, attributes, assertions, outside, unclear.

### Trends Section Tabs

The trends section has two tabs:
- **📅 לפי חודשים** (`growthView`): Charts organized by baby's age in months
- **🔢 לפי סדר רכישה** (`acquisitionView`): Charts organized by word acquisition order

Tab switching uses `requestAnimationFrame` before rendering to ensure correct canvas dimensions.

### Charts — "לפי חודשים" Tab

1. **Cumulative Growth** (SVG, `trendsSvg`): Total words over time, interactive cursor
2. **New Words Per Month** (SVG, `deltaSvg`): Bar chart, best month highlighted pink
3. **Stat Card** (`trendsStatCard`): "בחודש X דניאלה למדה לא פחות מ-Y מילים חדשות"
4. **Stacked Bars** (`vchart1`): "כמה מילים בכל קטגוריה לפי גיל" — with slider and breakdown
5. **Category Percentage Trends** (`vchart3`): Dashed lines showing each category's % over months. Click line to highlight, click elsewhere to reset. Shows count + total on interaction.
6. **Proportional Bar** (`vchart2`): "מה החלק של כל קטגוריה מתוך כלל המילים" — animated, wave toggle

### Charts — "לפי סדר רכישה" Tab

1. **Noun Bias Trend** (`acqNounBiasCanvas`): Line chart showing noun-to-other ratio over vocabulary growth
2. **Rolling Category Mix** (`acqPulseCanvas`): Horizontal stacked bars per word window (configurable size)
3. **Milestone Comparison** (`acqMilestonesCanvas`): Category composition at key milestones
4. **Stat Card** (`acqStatCard`): Dynamic stat about diversity, noun bias, or category spread
5. **Category Streaks** (`acqStreaksList`): Longest streak per category (>3 words), with compact word list and "load more" button if >10 words
6. **Last Streak Stat** (`acqLastStreakCard`): Stat card showing the most recently acquired streak
7. **Insights** (`acqInsightsList`): Auto-generated textual insights (burst, late emergence, dominance, etc.)

### Chart Design Standards

All charts use canvas with `devicePixelRatio` scaling for retina displays.

#### Percentage Display Rules
- Percentages ≥ 10%: round to integer (`Math.round`)
- Percentages < 10%: show 1 decimal place (`.toFixed(1)`)
- **Always show actual word count alongside percentage** — never percentage alone
- Format: `count (pct%)` inside bars, `count מילים · pct%` in labels

#### Stat Card Pattern
Stat cards (`.trends-stat-card`) follow this design:
- White card with rounded corners (20px), centered text
- Use `<span class="stat-highlight">` for key data (month name, count, percentage)
- Highlights use `statShimmer` animation (gradient sweep) when revealed
- Icon via Lucide (`<i data-lucide="...">`) with `.stat-icon` class
- Text format: narrative sentence with embedded highlights, e.g. "בחודש **X** דניאלה למדה לא פחות מ-**Y מילים חדשות**"
- Reveal via `IntersectionObserver` with `threshold: 0.3`
- Stagger highlight animation delays: 0.3s, 1.5s, 2.5s

#### Chart Card Pattern (acquisition)
- `.acq-card` class with **two-tier title system**:
  - **Static title**: `<h3 class="acq-card-static-title">` — always visible, describes what the chart is (e.g. "מגמת הטיית שמות עצם")
  - **Dynamic title**: `<p class="acq-card-title acq-card-dynamic-title">` — data-driven key insight sentence, set by JS (e.g. from `getNounBiasTitle()`)
  - **Subtitle**: `<p class="acq-card-subtitle">` — shorter description below
- Tooltip area for click interaction details
- Legend row with colored dots

#### Acquisition Order & Streak Rules (IMPORTANT)
Words may not be logged in exact acquisition order (same-day bulk updates, retroactive entries).
All acquisition-order-based analysis (streaks, insights, charts) must account for this:

- **Streak definition**: A run of same-CDI-**category** (NOT sub-category) words where each
  consecutive pair has at most **5 other words** between them in acquisition order.
  This `STREAK_GAP = 5` constant is in `acquisition-analysis.js`.
- **Rationale**: If a modifier word appears, then 4 nouns, then another modifier — the two
  modifiers may have been acquired closer together but logged out of order. The ±5 tolerance
  accounts for this imprecision.
- **Algorithm** (`getCategoryStreaks()`): For each CDI category, collect all words of that
  category sorted by acquisition index. Walk through consecutive pairs; if index difference
  ≤ 5, they're in the same streak. Only streaks with >3 words are displayed.
- **Last streak** (`getLastStreak()`): The streak whose last word has the highest acquisition
  index. Prefers streaks >3 words, falls back to >1.

### Classification Standards (IMPORTANT)

**All word classification lives in the DB** (`cdi_category` and `sub_category` columns in the `words` table). There is no separate JSON file.

#### When Adding Words to DB
Every word MUST have `cdi_category` and `sub_category` set. Use the category picker in the add-word flow or set via Supabase directly.

#### Classification Rules
| Category | When to Use | Sub-categories |
|----------|------------|----------------|
| `general_nominals` | Common nouns (animals, food, body parts, objects) | animals, food_drink, body_parts, clothing, household, toys_and_routines, outside |
| `specific_nominals` | Proper names (people, characters, pets by name) | people |
| `action_words` | Verbs, action requests (come, walk, blow) | actions |
| `modifiers` | Adjectives, quantities, numbers (hot, cold, more, 1/2/3) | attributes |
| `personal_social` | Greetings, social words, sound effects, assertions | routines_and_games, sound_effects, assertions |
| `unclear` | Genuinely unknown meaning | unclear |

#### Data Flow for Charts & Stats
```
DB (words table) → app.js loadWords() → global `words` array
                                              ↓
                    ┌─────────────────────────┼─────────────────────────┐
                    ↓                         ↓                         ↓
            vocab-charts.js           acquisition-analysis.js      app.js renderTrends()
            VocabCharts.render(words)  AcquisitionAnalysis.*()      SVG growth/delta charts
            (category bars, %)         (streaks, insights, etc.)   (cumulative, per-month)
```
All charts/stats read from the global `words` array (fetched from Supabase). No JSON files involved.

#### Current DB Stats (April 2026)
- Total words: 114 (106 unique + 8 evolution variants)
- Categories: general_nominals(68), personal_social(14), specific_nominals(10), modifiers(6), action_words(5), unclear(3)

## PWA (Progressive Web App)

### Overview
The app is a fully installable PWA. Users visit the site on Android/iOS and get prompted to "Install" it to their home screen. Once installed, it runs in standalone mode (no browser chrome).

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Manifest | `manifest.webmanifest` | App name, icons, shortcuts, display mode |
| Service Worker | `sw.js` | Caching, offline, push notification handling |
| Quick Add | `quick-add.html` | Minimal page for "Add word" shortcut |
| Icons | `icons/icon-{192,512}x{192,512}.png` | App icons |
| PWA Module | `app.js` (bottom) | SW registration, install prompt, realtime, push |
| Push Schema | `supabase/push-schema.sql` | Push subscription storage |
| Edge Function | `supabase/functions/notify-new-word/` | Server-side push delivery |

### Features
1. **Installable** — `beforeinstallprompt` event shows install banner after 3s delay
2. **Offline** — Service worker caches static assets (stale-while-revalidate strategy)
3. **Real-time sync** — Supabase Realtime subscription on `words` table; shows toast when another device adds a word
4. **Push notifications** — Web Push API; permission requested after user's first word add (not on page load)
5. **Quick add shortcut** — Manifest shortcut opens `quick-add.html` directly
6. **Auto-update** — SW detects new version, shows "refresh" toast

### Service Worker Cache Strategy
- **Local assets**: Stale-while-revalidate (serve cached, update in background)
- **Supabase API**: Network only (always fresh data)
- **Supabase SDK**: Network first, cache fallback
- **Google Fonts**: Cache first (rarely change)
- **Offline navigation**: Falls back to cached `index.html`

### Install Banner UX
1. `beforeinstallprompt` fires → stored in `deferredInstallPrompt`
2. After 3s delay, `.pwa-install-banner` shown (fixed bottom)
3. "התקינו" button → calls `deferredInstallPrompt.prompt()`
4. Dismiss button → hides for 24h (stored in `localStorage.pwa_install_dismissed`)
5. If already in standalone mode → banner never shown

### Push Notification Setup (requires manual steps)
1. Run `npx web-push generate-vapid-keys` to get VAPID key pair
2. Store public key in `localStorage.vapid_public_key` on each device (or hardcode in app.js)
3. Run `supabase/push-schema.sql` in Supabase SQL Editor
4. Deploy Edge Function: `supabase functions deploy notify-new-word`
5. Create Database Webhook in Supabase Dashboard: table=words, event=INSERT, function=notify-new-word
6. Set secrets: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...`

### Realtime (works out of the box)
- Requires running: `ALTER PUBLICATION supabase_realtime ADD TABLE words;` in SQL Editor
- Once enabled, all open app instances receive live word updates
- Toast notification shown when another device adds a word

### Key Globals (PWA section of app.js)
| Variable | Purpose |
|----------|---------|
| `deferredInstallPrompt` | Stored install prompt event |
| `realtimeChannel` | Supabase Realtime channel |

### Version Check & Update System

On each app load, `checkForUpdates()` fetches `version.json` (with cache-busting query param) and compares against `localStorage.app_version`.

**`version.json` format:**
```json
{
  "version": "1.0.0",
  "mandatory": false,
  "message": "גרסה ראשונה של האפליקציה"
}
```

**Behavior:**
- **Mandatory update** (`mandatory: true`): Modal blocks entire app, no dismiss button, must tap "עדכנו עכשיו" which clears SW cache and navigates to `install.html`
- **Optional update** (`mandatory: false`): Modal has dismiss button ("אחר כך"), reappears on every app open until user updates or version.json changes
- Version stored in `localStorage.app_version` after user installs/updates
- Update button sends `CLEAR_CACHE` message to SW, then navigates to `install.html`

**To push an update:**
1. Edit `version.json` — bump version, set mandatory flag, write Hebrew message
2. Push to main — GitHub Pages deploys, all app instances pick up new version on next load

**Related DOM:** `#updateModal`, `.update-modal-content`, `#updateTitle`, `#updateMessage`, `#updateVersion`, `#updateBtn`, `#dismissUpdate`

## Android Widget (Companion App)

### Overview
A minimal native Android app that provides a home screen widget for quick word addition. The widget calls the Supabase REST API directly — no browser needed.

### How It Works
1. Widget on home screen shows app branding and "tap to add" prompt
2. Tapping opens a transparent WebView overlay that loads `quick-add.html`
3. The add flow (word, age, submit) comes from the web — always up to date
4. No APK update needed for UI changes, only for widget home screen appearance

### Building the APK
- GitHub Actions workflow (`build-widget.yml`) auto-builds on push to `main`
- APK is uploaded as a GitHub Release artifact
- Family members download the APK from the Releases page and install directly (sideload)

### Key Files
| File | Purpose |
|------|---------|
| `AddWordActivity.kt` | WebView dialog — loads quick-add.html from web |
| `WordWidgetProvider.kt` | Widget lifecycle, click handling, word count |
| `SupabaseApi.kt` | Direct REST API calls to Supabase (no SDK) |
| `LauncherActivity.kt` | Opens PWA URL in browser |
| `widget_layout.xml` | Widget home screen appearance |
| `widget_layout.xml` | Widget home screen appearance |
| `build-widget.yml` | GitHub Actions APK build workflow |

### Installation
1. On Android phone, open the GitHub Releases page
2. Download the APK file
3. Open the downloaded file
4. Allow "Install from unknown sources" if prompted
5. Install
6. Long-press home screen → Widgets → find "דנדן" → add to home screen

---

## Search System

- `fuzzyMatch()`: substring → char-sequence → Levenshtein distance
- `getSearchRelevance()`: exact=4, startsWith=3, contains=2, notesContains=1, fuzzy=0
- Auto-switches to grid view during search, restores previous view on clear
- Same fuzzy engine used for word linking search in both add-flow and edit modal

---

## Pre-Push Checklist

**Run ALL of these before every push. They prevent recurring bugs.**

### 1. Cache Busters

```bash
grep 'app.js?v=' index.html && grep 'styles.css?v=' index.html && grep 'vocab-charts.js?v=' index.html
```

Increment `?v=N` for every file you changed. Current versions: styles.css?v=21, app.js?v=23, acquisition-analysis.js?v=3, vocab-charts.js?v=14.

### 2. RTL Arrows

```bash
grep -n '→' js/app.js | grep -v '//'
```

Must return ZERO lines. All user-visible arrows: `←` only. Key locations:
- `join(' ← ')` in grid card link (~line 988)
- `join(' ← ')` in timeline card link (~line 1640)
- `'←'` in modal mini-timeline (~line 1159)

### 3. No Broken References

```bash
grep -oP '(?:href|src)="([^"]*\.(css|js))"' index.html | sed 's/.*="//;s/"//;s/?.*//' | while read f; do [ ! -f "$f" ] && echo "MISSING: $f"; done
```

### 4. JS Syntax Valid

```bash
node -c js/app.js && node -c js/vocab-charts.js && echo "OK"
```

### 5. Git Status Clean

```bash
git status --short
```

No untracked files that should be committed.

### 6. Key Content

```bash
grep 'מגמות' index.html    # Should be just "מגמות" not "מגמות צמיחה"
grep 'words-title' index.html  # Emoji 💬 on the RIGHT/start in RTL
```

---

## Known Gotchas & Regressions

| Bug | Cause | Fix |
|-----|-------|-----|
| Changes don't appear on live site | Browser cache | Increment `?v=N` cache buster |
| `→` arrows instead of `←` | Old cached JS | Cache buster + verify with grep |
| 404 on new file | Not git-tracked | `git add` before push |
| Timeline shows all words | `timelineDisplayCount` not reset to 10 | Check `renderWords()` |
| Stat highlights invisible | Conflicting CSS animations | Only use `statShimmer`, no `statPop` |
| Chart % wrong / ghost categories | Using animation state for labels | Use `actualPcts` and real `activeCats` |
| Proportional bar not 100% | Animated values not normalized | Normalize: `current[c]/animSum * barH` |
| Delete uses native `confirm()` | Regression | Must use `#deleteConfirmModal` |
| Word linking uses `<select>` | Regression | Must use fuzzy search input |
| vocab-charts shows stale data | Words not refreshed after add/edit | `VocabCharts.render(words)` called in `loadWords()` |
| Edit modal stuck in edit mode | `switchToViewMode()` not called | Verify modal state on open |
| Delta chart no spacing from chart above | `.trends-chart-container` had no margin-top | Added `.trends-chart-container + .trends-chart-container { margin-top: 1.2rem }` |

---

## Self-Update Protocol

After completing ANY task:

1. **Update line numbers** in this file if code was modified significantly
2. **Update file sizes/line counts** if files grew or shrank notably
3. **Add new gotchas** if a bug was found and fixed
4. **Update cache buster versions** listed in this file
5. **Update DB word count** in this file if words were added to DB
6. **Update `BABY_MAX_AGE`** if baby has passed documented age cap
7. **Add/remove features** from section table if DOM changed
8. **Update IMPROVEMENTS.md** if a listed improvement was completed
