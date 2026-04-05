# Wordbydandan - Project Documentation

## Overview
"המילים הראשונות של דניאלה" (Daniella's First Words) - A baby milestone tracker website that documents a baby's first words with timestamps and context.

**Live site:** Hosted on GitHub Pages  
**Repository:** `Tm9hbQn/Wordbydandan`  
**Language:** Hebrew (RTL)  
**Baby name constant in code:** `BABY_NAME` (set to "דניאלה")  
**Birth date constant:** `BABY_BIRTHDAY` (set to "2024-12-05")

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **Backend:** Supabase (PostgreSQL) with localStorage fallback
- **Fonts:** Google Fonts - Secular One, Varela Round, Karantina, Suez One
- **Icons:** Lucide Icons (via CDN)
- **Hosting:** GitHub Pages

## File Structure
```
/
├── index.html              # Main single-page app
├── tests.html              # Pixel art character studio / test page
├── vocabulary.json         # Static vocabulary data with CDI categories (76 words)
├── CLAUDE.md               # This file - READ BEFORE MAKING CHANGES
├── css/
│   ├── styles.css          # All main site styles (~2400 lines)
│   ├── pixel-baby.css      # Pixel art baby character styles (not loaded in main)
├── js/
│   ├── app.js              # All main app logic (~2000 lines)
│   ├── vocab-charts.js     # Vocabulary analysis charts (CDI categories, 4 cards)
│   ├── pixel-baby.js       # Pixel art baby character code (not loaded in main)
└── supabase/               # Supabase config
```

## Site Sections (top to bottom)
1. **Header** - Gradient background with baby emoji, alphabet blocks (א ב ג), site title
2. **Input Section** - Word input field with marker-style design, "הוסיפו" button
3. **Age Picker** - Scroll wheel picker for baby's age when word was spoken
4. **Notes Section** - Optional context/story about the word + link toggle (see below)
5. **Success Toast** - Animated notification after adding a word
6. **Section Navigation** - Sticky nav bar with "אוצר מילים" / "מגמות" tabs + "הוסיפו מילה" button. Updates active state on scroll via IntersectionObserver
7. **Words Section** - Display all words with Grid/Timeline toggle, search. Timeline shows 10 latest words by default with "load more" button (loads 50 more, then all remaining). Has blur-fade at bottom before load-more button
8. **Trends Section** - Growth chart (SVG), stat card with Lucide trending-up icon, 4 vocabulary analysis cards
9. **Word Edit Modal** - View/edit word details, evolution chain linking
10. **Evolution Chain Modal** - Full chain view with reorder controls
11. **Footer** - Copyright, export button, test page link

---

## Data Layer

### Database Schema (Supabase)
```sql
words {
  id: UUID (primary key)
  word: TEXT
  age_months: INTEGER (nullable)
  notes: TEXT (nullable)
  linked_to: UUID (nullable, FK to words.id)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

### vocabulary.json (Static CDI Data for Charts)
- **Purpose:** Powers the vocabulary analysis charts in the trends section
- **Kept in sync manually** with the Supabase DB — when words are added to DB, also add to vocabulary.json
- **76 entries** (as of April 2026), each with: `id`, `word`, `target_meaning`, `age_in_months`, `cdi_category`, `sub_category`, `notes`
- **Linked words (evolution chains) are ONE entry** using the earliest age. Notes mention the chain (e.g., "שרשרת: בא → פא פא → אבא")
- Words with `linked_to` in DB = later pronunciation of an existing concept, NOT a new word

### CDI Classification System (MacArthur-Bates Standard)
Words are classified by **semantic function for the baby**, not dictionary definitions.

**5 Main Categories (displayed in charts):**

| `cdi_category` | Hebrew Label | Description |
|---|---|---|
| `general_nominals` | שמות עצם כלליים | Physical objects, animals, concepts in categories |
| `specific_nominals` | שמות עצם ספציפיים | Specific people or pets by name |
| `action_words` | מילות פעולה | Verbs, action requests |
| `modifiers` | מתארים | Adjectives, states, locations |
| `personal_social` | אינטראקציה וחברה | Social routines, sound effects, assertions, desires |
| `unclear` | לא ברור | Uncategorized (excluded from charts) |

**Sub-categories within each main category:**

- `general_nominals`: `animals`, `food_drink`, `body_parts`, `clothing`, `toys_and_routines`, `vehicles`, `household`
- `specific_nominals`: `people`, `pets`
- `action_words`: `actions`
- `modifiers`: `attributes`, `states`, `locatives`
- `personal_social`: `routines_and_games`, `sound_effects`, `assertions`, `state_and_desire`

**Classification Edge Cases (CDI "Gold Standard" Rules):**
- **Animal sounds as nouns:** "הב-הב" used to NAME the dog → `general_nominals/animals` (not sound_effects)
- **Animal sounds as imitation:** "מיאו" while playing → `personal_social/sound_effects`
- **Location words as actions:** "למעלה" meaning "pick me up" → `action_words` (functional intent = action)
- **Objects as action requests:** "דלת" meaning "open the door" → keep as `general_nominals/household` (CDI standard: physical objects stay as nominals)
- **Control words (עוד/די/אין/לא):** Always `personal_social/state_and_desire` or `assertions`, even when said next to food

### Colors for Chart Categories
```js
general_nominals: '#6C5CE7'  // purple
specific_nominals: '#FF6B9D' // pink
action_words: '#4DD0E1'      // cyan
modifiers: '#FFD93D'          // yellow
personal_social: '#CE93D8'   // lavender
```

---

## Search System

### Fuzzy Search (app.js)
- Uses **Levenshtein distance** algorithm for typo tolerance
- Searches both `word` and `notes` fields
- **Relevance scoring** (lower = better): exact match (0) > starts-with (1) > contains (2) > Levenshtein ≤1 (3) > Levenshtein ≤2 (4) > notes match (5) > fuzzy (6+)

### Search UX Behavior
- **Auto-switches to grid view** when user starts typing (stores previous view)
- **Restores previous view** when search is cleared
- **Results sorted by relevance** — best match appears first
- **Exact match glow:** Cards matching exactly get class `exact-match-glow` with animated pink pulse border (`exactMatchPulse` CSS keyframes)
- State: `searchQuery` (global), `preSearchView` (stores view before search)

### `isExactMatch(query, wordObj)`
Returns true if query exactly matches the word or appears in parentheses in the word text.

### `findSimilarWords(text)`
Used by duplicate detection. Finds words with Levenshtein ≤1, substring matches, or parenthetical target meaning matches. Returns max 5 results.

---

## Adding a New Word Flow

### Step-by-step flow (app.js)
1. **Input** → User types word and clicks "הוסיפו" or presses Enter
2. **Duplicate Check** → `findSimilarWords()` runs on the input text
   - If similar words found → show `dup-overlay` modal with matches
   - User picks existing word → opens edit modal, cancels add
   - User clicks "לא, להוסיף כמילה חדשה" → proceeds to step 3
   - If no similar words → proceeds directly to step 3
3. **Age Picker** → Swish animation hides input, shows age wheel
4. **Notes Section** → After age selected, shows:
   - Text input for context/story
   - **Link toggle** (checkbox: "מילה מקושרת - התפתחות של מילה קיימת")
   - When checked → dropdown appears listing all root words (no `linked_to`) sorted by age descending
   - Selected word ID stored in `currentLinkedTo`
5. **Save** → `saveNewWord(notes)` calls `insertWord()` with `{ word, age_months, notes, linked_to }`
6. **Success Toast** → Shows confirmation, reloads word list

### Key State Variables
- `currentWord` - word being added
- `currentAgeMonths` - selected age
- `currentLinkedTo` - UUID of linked word (null if not linked)
- `submitting` - prevents double submission

### Duplicate Detection Modal
- Class: `dup-overlay` / `dup-modal`
- Shows up to 5 similar words with word text and age
- Clicking a match opens its edit modal
- "No" button proceeds with adding the new word
- Clicking overlay background closes it

---

## Vocabulary Analysis Charts (vocab-charts.js)

### Architecture
- Self-contained IIFE, loads `vocabulary.json` via fetch
- All charts use `<canvas>` with manual 2D context drawing (no chart library)
- Each card has an independent time slider
- `BABY_MAX_AGE = 16` months cap

### Card 1: "אבולוציית הקטגוריות" (Category Evolution)
- **Stacked bar chart** per month showing cumulative word count by main CDI category
- Click a bar → tooltip updates to show that month's breakdown
- Default tooltip shows full breakdown up to slider value
- Uses `buildCategoryBreakdownHTML()` for tooltip content

### Card 2: "חלוקה יחסית של הקטגוריות" (Relative Distribution)
- **Single proportional stacked bar** (vertical column) with percentage labels
- Smooth animation between slider values using `propAnimState` + `requestAnimationFrame`
- Labels with connecting lines drawn on the right side of the bar

### Card 3: "מפת תשומת הלב" (Attention Map)
- **Bubble chart** showing CDI main categories sized by word count
- Simple spiral layout algorithm, no physics simulation
- Bubble size proportional to category count

### Card 4: "השוואת גידול בין תקופות" (Period Comparison)
- **Two dropdown selectors** for start/end period (age in months)
- **Horizontal bar pairs** per category: faded bar (from-period) + solid bar (to-period)
- **Growth indicator** per category showing absolute change + percentage
- **Toggle** between absolute (כמות) and relative (אחוזים) modes
- Summary row at bottom with total growth
- Bars animate in via CSS transition (`comp-bar.animated` class)
- State: `compState = { mode, fromAge, toAge }`

### Chart Data Flow
```
vocabulary.json → fetch → vocabData (filtered by BABY_MAX_AGE)
                        → getWordsUpTo(age) → getCategories(words)
                        → CAT_ORDER loop → draw bars/bubbles
```

### Adding a New Chart
1. Create draw function (canvas-based or HTML-based)
2. Create card in `buildCards()` using `createCard(title, id, hasSlider)`
3. If slider needed, call `setupSlider(id, range, callback)`
4. If legend needed, call `buildLegend(id, items)` with `CAT_COLORS`/`CAT_LABELS`

---

## Key Design Decisions

### RTL Layout
- Site is fully RTL (`dir="rtl"` on `<html>`)
- All arrows in evolution chains use `←` (right-to-left)
- CSS `left`/`right` are visual positions (not logical)

### Color Palette (CSS Variables)
```
--pink: #FFE5EC       --hot-pink: #FF6B9D
--peach: #FFF3E0      --teal: #4ECDC4
--mint: #E8F5E9       --yellow: #FFD93D
--baby-blue: #E3F2FD  --coral: #FF8A80
--lavender: #F3E5F5   --deep-purple: #2D1B69
--bg: #FFF9FB         --soft-purple: #6C5CE7
```

### Typography
- `Secular One` - Headings (bold Hebrew)
- `Varela Round` - Body text (rounded, friendly)
- `Karantina` - Word display text (playful, large)

### Section Navigation
- Sticky nav bar INSIDE the words section (not above it)
- Contains two rows: section tabs (אוצר מילים/מגמות + הוסיפו מילה) and view toggle (רשת/ציר זמן)
- Sticks to top of viewport when scrolling through words/trends sections
- Buttons are large and centered for mobile accessibility
- Active tab updates automatically on scroll via IntersectionObserver
- Uses backdrop-filter blur for glassmorphism effect

### Timeline Pagination
- Default: shows 10 most recent words (sorted by age descending)
- "טענו עוד" button loads 50 more words at a time
- If remaining < 50, shows "טענו את כל X המילים"
- Blur-fade gradient at bottom before the load-more button
- `timelineDisplayCount` resets to 10 on any re-render (search, new word added)
- State variable: `timelineDisplayCount` (global in app.js)

### Evolution Chains
Words can be linked to show language evolution (e.g., "בא" → "פא פא" → "אבא").
- Arrows always point right-to-left (← direction)
- This applies in: word card link text, timeline card link, modal mini-timeline
- The evolution chain modal uses vertical connectors with ▼ arrows

### Stat Card Highlights
- Bold/highlighted text (`.stat-highlight`) animates in ONCE with `statPop`
- After initial animation, a shimmer effect loops (`statShimmer`) 
- No glowing underlines (removed)
- Uses `background-clip: text` for the shimmer gradient effect

### Words Title
- Format: `💬 המילים של דניאלה` (emoji on the RIGHT/start side in RTL)

### Trends Section
- Title is just "מגמות" (without "צמיחה")
- Stat card has a Lucide `trending-up` icon
- Main growth chart has title "גידול בסך אוצר המילים על פני זמן"

### Planned improvements (not yet implemented)
- Each chart should have a subtitle/description explaining what it shows
- Category labels in legends should be clickable to show CDI category explanations
- Main trends chart ("גידול בסך אוצר המילים") should also have a slider and persistent info panel below it

---

## Pixel Art Baby Character (WIP)
A pixel art baby girl character is being developed for the site:
- **Description:** Baby with golden-blonde slightly reddish hair in a small ponytail close to the scalp, pink dress with white polka dots
- **Current status:** Removed from main site, development continues on test page
- **Known issues with previous attempt:**
  - Eyes looked cross-eyed (highlights facing inward)
  - Ponytail was too tall/prominent
  - Smile wasn't visible enough
  - Animation positioning was poor (baby hidden behind elements)
- **Fix approach:** Use single-pixel eyes at 12px width, outward-facing highlights at 16px width; smaller ponytail; distinct lip color for smile

---

## Development Notes
- The site is a single-page app with no build step
- All JS is vanilla (no transpilation needed)
- Cache-bust JS/CSS files with `?v=N` query parameter - **MUST increment on every JS or CSS change**
- The site uses IntersectionObserver for scroll-reveal animations
- Fuzzy search uses Levenshtein distance algorithm with relevance scoring
- Timeline is vertical (flex-direction: column) with vertical scroll
- Always test on mobile viewport (~375px width) as the site is mobile-first (max-width: 600px/700px)

## Git Workflow
- Main branch: `main`
- Feature branches: `claude/*` naming convention
- Push to main for deployment (GitHub Pages auto-deploys)

---

## Critical Pre-Push Checklist

**ALWAYS run these checks before pushing. They prevent 80% of recurring bugs.**

### 1. Cache Buster Updated
```bash
grep 'app.js?v=' index.html
grep 'styles.css?v=' index.html
grep 'vocab-charts.js?v=' index.html
```
The `?v=N` number in `<script src="js/app.js?v=N">`, `<link href="css/styles.css?v=N">`, and `<script src="js/vocab-charts.js?v=N">` MUST be incremented whenever the respective file changes. Without this, browsers serve stale JS/CSS and changes appear broken.

### 2. RTL Arrow Direction
```bash
grep '→' js/app.js
```
There must be ZERO `→` arrows in content-generating code (comments are OK). All user-visible arrows in evolution chains must use `←` (right-to-left). Check these locations:
- `join(' ← ')` in word card link text (~line 770)
- `join(' ← ')` in timeline card link text (~line 1367)
- `'←'` in modal mini-timeline arrow (~line 939)

### 3. Files Referenced in HTML Actually Exist
```bash
# Check all CSS/JS refs in index.html resolve to real files
grep -oP '(?:href|src)="([^"]*\.(css|js))"' index.html | while read f; do
  file=$(echo "$f" | sed 's/.*="//;s/"//;s/?.*//')
  [ ! -f "$file" ] && echo "MISSING: $file"
done
```
Prevents 404 errors from referencing removed or renamed files.

### 4. Pixel Baby Not Loaded in Main Site
```bash
grep 'pixel-baby' index.html
```
Must return empty. The pixel baby CSS/JS are NOT loaded in the main site (removed, development on tests.html only).

### 5. HTML/JS Syntax Sanity
```bash
# Check for unclosed strings or obvious JS errors
node -c js/app.js 2>&1 | head -5
node -c js/vocab-charts.js 2>&1 | head -5
```
Quick syntax validation before pushing.

### 5b. Vocabulary JSON Validity
```bash
node -e "JSON.parse(require('fs').readFileSync('vocabulary.json','utf8'))" 2>&1 | head -3
```
Ensure vocabulary.json is valid JSON. Each entry needs: id, word, target_meaning, age_in_months, cdi_category, sub_category, notes.

### 6. All New Files Are Git-Tracked
```bash
git status --short
```
Check that any new files (like tests.html) are staged. Untracked files won't deploy to GitHub Pages.

### 7. Key Text Content Verification
```bash
# Trends title should be just "מגמות" (not "מגמות צמיחה")
grep 'מגמות' index.html
# Words title emoji should be at the START (right in RTL)
grep 'words-title' index.html
```

### Common Gotchas Log
| Issue | Root Cause | Prevention |
|-------|-----------|------------|
| Arrows showing `→` instead of `←` | Browser cache serving old JS | Increment `?v=N` cache buster |
| New page showing 404 | File not committed/pushed | Run `git status` before push |
| Pixel baby appearing on main site | CSS/JS still referenced in index.html | Check with `grep pixel-baby index.html` |
| CSS changes not reflecting | Browser cache | Increment `?v=N` on CSS link (ALWAYS do this) |
| Nav buttons look unstyled | CSS cache buster not updated | Increment styles.css?v=N |
| Timeline showing all words (no pagination) | `timelineDisplayCount` not resetting | Verify reset in `renderWords()` |
| Stat card highlights broken | Multiple conflicting animation declarations | Check CSS specificity order |
| Charts showing sub-categories | `cdi_category` field has old values | Ensure vocabulary.json uses 5 main categories |
| Duplicate detection not working | `findSimilarWords` not finding match | Check Levenshtein threshold and substring logic |
