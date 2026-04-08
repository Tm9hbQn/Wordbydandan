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
- **Database:** Supabase (PostgreSQL) with automatic localStorage fallback
- **Fonts:** Google Fonts — Secular One (headings), Varela Round (body), Karantina (word display), Suez One (minimal use)
- **Icons:** Lucide Icons v0.344.0 (CDN)
- **Hosting:** GitHub Pages

## File Map

```
/
├── index.html              # Single-page app (~409 lines)
├── docs.html               # Documentation viewer — renders CLAUDE.md, IMPROVEMENTS.md, changelog (~307 lines)
├── tests.html              # Pixel art character studio (369 lines, NOT linked from main)
├── CLAUDE.md               # THIS FILE — read before every task
├── IMPROVEMENTS.md         # 20/80 optimization roadmap
├── css/
│   ├── styles.css          # All main styles (~3087 lines)
│   └── pixel-baby.css      # Pixel baby styles (NOT loaded in main site)
├── js/
│   ├── app.js              # Main app logic (~3224 lines)
│   ├── acquisition-analysis.js # Acquisition analysis engine, module pattern (~525 lines)
│   ├── vocab-charts.js     # Vocabulary analysis charts, IIFE pattern (~726 lines)
│   └── pixel-baby.js       # Pixel baby character (NOT loaded in main site)
└── supabase/
    └── schema.sql          # DB schema with RLS policies
```

## Loading Order & Dependencies

Understanding this prevents 90% of "it doesn't work" issues:

```
1. Google Fonts (preconnect + stylesheet)
2. css/styles.css?v=19          ← all visual styles
3. HTML body renders
4. Supabase JS SDK (CDN)        ← must load before app.js
5. Lucide Icons (CDN)           ← must load before app.js calls lucide.createIcons()
6. js/app.js?v=21               ← main logic, runs on DOMContentLoaded
6b. js/acquisition-analysis.js?v=3 ← acquisition analysis engine (module)
7. js/vocab-charts.js?v=13      ← chart IIFE, exposes VocabCharts.render(), called by app.js
```

**Critical:** `app.js` depends on `window.supabase` (SDK) and `lucide` (icons) being available. `vocab-charts.js` exposes `window.VocabCharts.render(words)` and is called by `app.js` after loading words from DB.

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
| 12 | Footer | `.main-footer` | Copyright, export btn, tests.html link, docs.html link |

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

## Pixel Baby Character (WIP — test page only)

- **Status:** Removed from main site. Development on `tests.html` only.
- **Files:** `css/pixel-baby.css`, `js/pixel-baby.js` — NOT loaded in `index.html`
- **Description:** Baby girl with golden-blonde reddish hair, small ponytail, pink polka-dot dress
- **Known issues:** Cross-eyed look, oversized ponytail, invisible smile, poor animation positioning

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

Increment `?v=N` for every file you changed. Current versions: styles.css?v=19, app.js?v=21, acquisition-analysis.js?v=3, vocab-charts.js?v=14.

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

### 4. Pixel Baby Not in Main Site

```bash
grep 'pixel-baby' index.html
```

Must return empty.

### 5. JS Syntax Valid

```bash
node -c js/app.js && node -c js/vocab-charts.js && echo "OK"
```

### 6. Git Status Clean

```bash
git status --short
```

No untracked files that should be committed.

### 7. Key Content

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
| Pixel baby on main site | CSS/JS referenced in index.html | Remove references |
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
