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
├── vocabulary.json         # Static vocabulary data with CDI categories (65 words)
├── CLAUDE.md               # This file - READ BEFORE MAKING CHANGES
├── css/
│   ├── styles.css          # All main site styles (~2200 lines)
│   ├── pixel-baby.css      # Pixel art baby character styles (not loaded in main)
├── js/
│   ├── app.js              # All main app logic (~1800 lines)
│   ├── vocab-charts.js     # Vocabulary analysis charts (CDI categories, 2 cards)
│   ├── pixel-baby.js       # Pixel art baby character code (not loaded in main)
└── supabase/               # Supabase config
```

## Site Sections (top to bottom)
1. **Header** - Gradient background with baby emoji, alphabet blocks (א ב ג), site title
2. **Input Section** - Word input field with marker-style design, "הוסיפו" button
3. **Age Picker** - Scroll wheel picker for baby's age when word was spoken
4. **Notes Section** - Optional context/story about the word
5. **Success Toast** - Animated notification after adding a word
6. **Section Navigation** - Sticky nav bar with "אוצר מילים" / "מגמות" tabs + "הוסיפו מילה" button. Updates active state on scroll via IntersectionObserver
7. **Words Section** - Display all words with Grid/Timeline toggle, search. Timeline shows 10 latest words by default with "load more" button (loads 50 more, then all remaining). Has blur-fade at bottom before load-more button
8. **Trends Section** - Growth chart (SVG, dashed lines), delta chart (bar chart), stat card with Lucide trending-up icon
9. **Word Edit Modal** - View/edit word details, evolution chain linking
10. **Evolution Chain Modal** - Full chain view with reorder controls
11. **Delete Confirmation Modal** - Custom styled delete confirmation (replaced native confirm())
12. **Footer** - Copyright, export button, test page link

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
- **Timeline link click behavior:** Opens evolution modal (same as grid view). Does NOT scroll the page.
- **Word linking UI** — BOTH the add-word flow AND the edit modal use the same smart search interface:
  - Fuzzy search input with suggestions appearing as-you-type (NOT a dropdown/select)
  - Results appear above the input (bottom: 100%) so the mobile keyboard doesn't cover them
  - Shows a badge with the selected word + remove button after selection
  - Uses `fuzzyMatchWord()` for matching

### Delete Confirmation
- Uses a **custom styled modal** (`#deleteConfirmModal`), NOT native `confirm()`
- Shows word name, styled icon, cancel/confirm buttons matching site aesthetics
- Closes on overlay click or cancel button

### Stat Card Highlights
- Bold/highlighted text (`.stat-highlight`) is **always visible** (no pop-in/fade)
- Only animation is `statShimmer` — a looping background-position shimmer
- No glowing underlines, no `statPop` (removed — was causing text to disappear)
- Uses `background-clip: text` for the shimmer gradient effect

### Words Title
- Format: `💬 המילים של דניאלה` (emoji on the RIGHT/start side in RTL)

### Trends Section
- Title is just "מגמות" (without "צמיחה")
- Stat card has a Lucide `trending-up` icon
- **Main growth chart**: title "גידול בסך אוצר המילים על פני זמן", dashed lines between data points, interactive vertical cursor line on hover/touch that snaps to nearest data point
- **Delta chart**: "מילים חדשות לפי חודש" — bar chart showing new words per month (not cumulative), best month highlighted in pink, same interactive cursor behavior

### Vocabulary Analysis Cards (below stat card)
- Data source: `vocabulary.json` (static file, CDI-categorized)
- Baby max age capped at 16 months (BABY_MAX_AGE in vocab-charts.js)
- **Card 1: "אבולוציית הקטגוריות"** - Stacked bars per month. Shows persistent category breakdown info below chart (not just on click). Info updates when slider moves or when user clicks a specific bar
- **Card 2: "חלוקה יחסית של הקטגוריות"** - Proportional stacked bar (single vertical column) showing relative % of each category. Animates smoothly when slider changes. Labels with counts and percentages on the side. **IMPORTANT:** Labels and active categories are determined by ACTUAL data, not animation state. Animation is normalized to always sum to 100%. Has wave view toggle.
- ~~Card 3 (bubble map) and Card 4 (period comparison) have been removed~~
- All cards have independent time sliders
- **CDI Categories (MacArthur-Bates standard):**
  - `people` (אנשים) - names of people and family titles
  - `sound_effects` (צלילים וקולות) - animal sounds, environmental sounds
  - `animals` (חיות) - animal names (not sounds)
  - `food_drink` (אוכל ושתייה) - food and drink names
  - `games_routines` (משחקים ושגרות) - social routines, greetings, body functions
  - `action_words` (מילות פעולה) - verbs
  - `descriptive_words` (מילות תיאור) - adjectives
  - `clothing` (ביגוד) - clothing items
  - `toys` (צעצועים) - toys and play items
  - `household` (חפצי בית) - household objects
  - `outside` (חוץ וטבע) - outdoor/nature items
  - `unclear` (לא ברור) - uncategorized
- When adding new words to DB, also update vocabulary.json with proper CDI categorization
- **Planned improvements (not yet implemented):**
  - Each chart should have a subtitle/description explaining what it shows
  - Category labels in legends should be clickable to show CDI category explanations
  - Main trends chart ("גידול בסך אוצר המילים") should also have a slider and persistent info panel below it
  - Bubble map should use CDI main categories (currently uses CDI categories correctly)

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

## Database Schema (Supabase)
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

## Development Notes
- The site is a single-page app with no build step
- All JS is vanilla (no transpilation needed)
- Cache-bust JS/CSS files with `?v=N` query parameter - **MUST increment on every JS or CSS change**
- The site uses IntersectionObserver for scroll-reveal animations
- Fuzzy search uses Levenshtein distance algorithm
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
| Chart shows wrong % or ghost categories | Animation state used for data display | Always use `actualPcts` for labels, `activeCats` from real data |
| Proportional bar doesn't fill 100% | Animated values not normalized | Normalize animated values: `animSum` then `current[c]/animSum * barH` |
| Delete uses native confirm() | Regression | Use `#deleteConfirmModal` custom modal, never `confirm()` |
| Add-flow link uses dropdown instead of search | Regression | Must use smart fuzzy search input, never `<select>` dropdown |
