# Wordbydandan — Optimization Roadmap

> **20% of work that delivers 80% of impact** — followed by the longer tail of nice-to-haves.

---

## Priority Tier: High-Impact Changes (20% effort → 80% value)

These changes will make future development faster, reduce bugs, and keep the site maintainable.

### 1. Extract Magic Numbers & Config to a Single Constants Object

**Problem:** ~30 magic numbers scattered across app.js (animation durations, pixel offsets, timeout values, pagination sizes, Levenshtein thresholds). When tuning behavior, you hunt through 2280 lines.

**Fix:** Create a `CONFIG` object at the top of app.js:
```js
const CONFIG = {
  TIMELINE_INITIAL: 10,
  TIMELINE_PAGE_SIZE: 50,
  TOAST_DURATION: 2000,
  ANIM_SECTION_SWAP: 400,
  ANIM_TOAST_HIDE: 300,
  WHEEL_CENTER_PX: 24,
  WHEEL_NEAR_PX: 72,
  SEARCH_HIDE_DELAY: 400,
  REVEAL_SAFETY_TIMEOUT: 1500,
  REVEAL_STEP_GRID: 0.06,
  REVEAL_STEP_TIMELINE: 0.08,
  REVEAL_MAX_DELAY: 0.5,
  LEVENSHTEIN_SHORT: 1,
  LEVENSHTEIN_LONG: 2,
  MAX_LINK_RESULTS: 8,
  TRENDS_RESIZE_DEBOUNCE: 250,
  TRENDS_TOOLTIP_TOUCH_HIDE: 2500,
};
```

**Impact:** Any future timing/UX tuning is a single-line change. Claude Code finds it instantly.

**Effort:** ~30 minutes. Search-and-replace each literal with `CONFIG.X`.

---

### 2. Auto-Increment Cache Busters via Git Hook

**Problem:** The #1 recurring bug is forgetting to increment `?v=N` in index.html. Every CSS/JS push risks serving stale files.

**Fix:** Add a pre-commit hook that:
1. Checks if `js/app.js`, `css/styles.css`, or `js/vocab-charts.js` are staged
2. For each changed file, auto-increments its `?v=N` in index.html
3. Re-stages index.html

```bash
#!/bin/bash
# .git/hooks/pre-commit
for pair in "js/app.js:app.js" "css/styles.css:styles.css" "js/vocab-charts.js:vocab-charts.js"; do
  file="${pair%%:*}"
  pattern="${pair##*:}"
  if git diff --cached --name-only | grep -q "^$file$"; then
    current=$(grep -oP "${pattern}\?v=\K[0-9]+" index.html)
    next=$((current + 1))
    sed -i "s/${pattern}?v=${current}/${pattern}?v=${next}/" index.html
    git add index.html
  fi
done
```

**Impact:** Eliminates the most common bug entirely. Zero cognitive load on cache busting.

**Effort:** ~15 minutes.

---

### 3. Split renderWords() Into Focused Functions

**Problem:** `renderWords()` is the largest function — it handles grid rendering, timeline rendering, word counting, empty state, scroll-reveal setup, AND triggers trends rendering. Any change risks breaking unrelated features.

**Fix:** Extract into:
- `renderGrid(filteredWords)` — grid card creation
- `renderTimeline(filteredWords)` — already partially extracted, but still called from renderWords
- `renderEmptyState()` / `hideEmptyState()`
- `updateWordCount(count)` — counter animation
- Keep `renderWords()` as a thin orchestrator

**Impact:** Each view can be modified independently. Bug fixes in grid don't risk breaking timeline. Claude Code can target the exact function.

**Effort:** ~1 hour. Pure refactor, no behavior change.

---

### 4. CSS Variable-ize All Animation Timings

**Problem:** 25 animation keyframes with hardcoded durations. Changing the "feel" of the site requires editing 25+ places. Some animations interact (toast show + hide timing must be coordinated).

**Fix:** Add to `:root`:
```css
--anim-fast: 0.3s;
--anim-normal: 0.4s;
--anim-slow: 0.5s;
--anim-modal: 0.4s;
--anim-toast: 0.4s;
--anim-reveal: 0.5s;
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-modal: cubic-bezier(0.16, 1, 0.3, 1);
```

Then use `var(--anim-fast)` in all animation declarations.

**Impact:** Global animation speed tuning becomes a single `:root` change. Coordinated timings stay consistent.

**Effort:** ~45 minutes.

---

### 5. Consolidate Word Card Creation Into a Single Factory

**Problem:** Word cards are built in 3 separate places: grid view (renderWords), timeline view (renderTimeline), and search results. Each duplicates the card HTML structure with slight variations. A change to card layout requires edits in all 3 places.

**Fix:** Create `createWordCard(word, variant)` that returns a DOM element:
- `variant: 'grid'` — compact card for grid
- `variant: 'timeline'` — card with timeline-specific wrappers
- Shared core: word text, age badge, notes, evolution link

**Impact:** Single source of truth for card HTML. New card features (e.g., adding a category badge) are one-time edits. Evolution chain display can't drift between views.

**Effort:** ~1 hour.

---

### 6. Add Error Boundary for Chart Rendering

**Problem:** If `vocabulary.json` fetch fails or contains malformed data, `vocab-charts.js` silently fails and the vocab cards section is just empty. No user feedback.

**Fix:** Wrap `init()` in try-catch with a visible fallback:
```js
try { await init(); }
catch(e) {
  console.error('Charts failed:', e);
  document.getElementById('vocabCards').innerHTML =
    '<p style="text-align:center;color:#999;padding:2rem;">טעינת הגרפים נכשלה</p>';
}
```

Also add schema validation on vocabulary.json parse (check required fields exist).

**Impact:** Prevents silent failures. Makes debugging chart issues instant instead of "why is it blank?"

**Effort:** ~20 minutes.

---

### 7. Unify the Two Word-Linking Search UIs

**Problem:** The add-flow linking (`#addFlowSearchInput`) and edit-modal linking (`#linkSearchInput`) have separate but nearly identical implementations. Both use `fuzzyMatchWord()`, both render results the same way, both have the badge+remove pattern. But they're coded independently — a fix in one doesn't propagate to the other.

**Fix:** Extract a reusable `WordLinkPicker` function:
```js
function setupWordLinkPicker({ inputEl, resultsEl, badgeEl, onSelect, onRemove }) { ... }
```

Call it for both add-flow and edit-modal contexts.

**Impact:** Word linking behavior is guaranteed consistent. Fixes apply once. Adding features (like showing word age in search results) happens in one place.

**Effort:** ~45 minutes.

---

### 8. Lazy-Load Vocab Charts

**Problem:** `vocab-charts.js` loads immediately and fetches `vocabulary.json` on page load, even though most users interact with the words section first. The charts are below the fold.

**Fix:** Use `IntersectionObserver` on `#vocabCards` to trigger chart initialization only when the section scrolls into view:
```js
const observer = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    observer.disconnect();
    init(); // existing chart initialization
  }
}, { rootMargin: '200px' }); // start 200px before visible
observer.observe(document.getElementById('vocabCards'));
```

**Impact:** Faster initial page load. Reduces network requests on first paint. Users who never scroll to charts save bandwidth entirely.

**Effort:** ~15 minutes.

---

### 9. Document the Z-Index & Stacking Context Contract

**Problem:** Z-indices are assigned ad-hoc (0, 1, 2, 5, 10, 20, 50, 100, 200). When adding new positioned elements, there's no guide for which layer to use. Overlap bugs are discovered only visually.

**Fix:** Already documented in CLAUDE.md (the new version). Additionally, add CSS comments:
```css
/* === Z-INDEX SCALE ===
 * 0     : Background decorative (floating elements)
 * 1-2   : Interactive pickers (age wheel)
 * 5     : Chart connectors
 * 10    : Content sections
 * 20    : Sticky navigation
 * 50    : Focus overlays
 * 100   : Toasts/notifications
 * 200   : Modal overlays
 * === END Z-INDEX SCALE === */
```

**Impact:** Prevents z-index inflation and overlap bugs. New elements get the right layer immediately.

**Effort:** ~10 minutes.

---

### 10. Pre-Commit Validation Script

**Problem:** The pre-push checklist in CLAUDE.md has 8 manual steps. Humans (and AI) sometimes skip steps.

**Fix:** Create `scripts/validate.sh` that runs all checks:
```bash
#!/bin/bash
set -e
echo "=== Syntax ==="
node -c js/app.js
node -c js/vocab-charts.js
node -e "JSON.parse(require('fs').readFileSync('vocabulary.json','utf8'))"

echo "=== RTL Arrows ==="
if grep -n '→' js/app.js | grep -v '//'; then echo "FAIL: → in app.js"; exit 1; fi

echo "=== Pixel Baby ==="
if grep -q 'pixel-baby' index.html; then echo "FAIL: pixel-baby in index.html"; exit 1; fi

echo "=== File References ==="
grep -oP '(?:href|src)="([^"]*\.(css|js))"' index.html | \
  sed 's/.*="//;s/"//;s/?.*//' | while read f; do
    [ ! -f "$f" ] && echo "MISSING: $f" && exit 1
  done

echo "=== All checks passed ==="
```

Wire this into the pre-commit hook (item #2 above).

**Impact:** All validation runs automatically. Zero manual checking. Catches issues before they hit production.

**Effort:** ~20 minutes.

---

## Summary: Priority Implementation Order

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 2 | Auto cache-bust hook | 15 min | Eliminates #1 bug |
| 10 | Validation script | 20 min | Prevents all known regressions |
| 1 | CONFIG constants object | 30 min | Faster tuning, less hunting |
| 6 | Chart error boundary | 20 min | No more silent failures |
| 8 | Lazy-load charts | 15 min | Faster page load |
| 9 | Z-index documentation | 10 min | Prevents stacking bugs |
| 4 | CSS animation variables | 45 min | Consistent animation control |
| 3 | Split renderWords() | 1 hr | Independent view development |
| 5 | Word card factory | 1 hr | Single source for card UI |
| 7 | Unified link picker | 45 min | Consistent word linking |

**Total: ~5.5 hours for all 10 items.** Items 1-6 alone (~2 hours) deliver most of the value.

---

## Lower Priority: The Other 80% (nice-to-haves)

These are good improvements but less urgent. Document for future consideration.

### Code Organization

- [ ] **Split app.js into modules** — Separate files for: database.js, ui.js, search.js, charts.js, modals.js. Use ES modules with a simple bundler or just `<script>` tags in order. Current 2280-line file is manageable but will grow.
- [ ] **Extract modal logic into a Modal class** — `openEditModal`, `closeEditModal`, `switchToEditMode`, `switchToViewMode` + evo modal + delete modal = ~400 lines of modal management that could be unified.
- [ ] **Type annotations via JSDoc** — Not TypeScript, but `@param` and `@returns` annotations would help Claude Code understand function contracts faster.
- [ ] **Event delegation** — Many click handlers are attached to individual elements. A single delegated handler on `#wordsGrid` and `#timelineTrack` would reduce listener count and handle dynamic content better.

### Performance

- [ ] **Virtual scrolling for timeline** — With 85+ words and growing, rendering all timeline DOM nodes is fine now but won't scale to 500+ words. A virtual scroller renders only visible items.
- [ ] **Debounce search input** — Currently re-renders on every keystroke. A 150ms debounce would reduce renders during fast typing.
- [ ] **Preload critical font** — Add `<link rel="preload" href="..." as="font">` for Varela Round to avoid FOUT.
- [ ] **Service Worker for offline** — Since localStorage fallback exists, a service worker could cache the entire app for full offline use.

### Features & UX

- [ ] **Chart subtitles** — Each chart should have a brief Hebrew description explaining what it shows.
- [ ] **Category legend tooltips** — Clicking a CDI category label shows what words belong to it.
- [ ] **Main trends chart slider** — Add a time slider to the growth chart (like vocab cards have) with persistent info panel.
- [ ] **Export to CSV/PDF** — Currently exports JSON to clipboard. CSV or PDF would be more family-friendly.
- [ ] **Undo delete** — Instead of permanent delete, add a 5-second "undo" toast after deletion.
- [ ] **Word frequency/usage tracking** — Track how often a word is used over time, not just when it first appeared.
- [ ] **Multi-language support** — The site is Hebrew-only. A language toggle could make it usable for other families.
- [ ] **Photo/audio attachment** — Link photos or voice recordings to words for richer documentation.

### Data & Analytics

- [ ] **Vocabulary.json auto-sync** — Currently vocabulary.json must be manually updated when words are added to DB. An export script could generate it from Supabase.
- [ ] **Growth percentile comparison** — Compare baby's vocabulary growth to MacArthur-Bates CDI norms.
- [ ] **Word cloud visualization** — Frequency-weighted word cloud as an additional chart type.
- [ ] **Category prediction** — Suggest CDI category when adding a new word based on similar existing words.

### Technical Debt

- [ ] **Remove Suez One font** — Loaded but barely used. Removing saves a font download.
- [ ] **Viewport meta tag** — Currently disables user scaling (`maximum-scale=1.0, user-scalable=no`). This hurts accessibility. Consider allowing pinch-zoom.
- [ ] **Inline styles in footer** — Export button and tests link use inline styles instead of CSS classes.
- [ ] **Contenteditable vs textarea** — The notes inputs use `contenteditable` divs which have quirky paste behavior. Standard `<textarea>` elements would be simpler.
- [ ] **Remove unused CSS** — Some animation keyframes may be unused after feature removals. Audit with coverage tool.
- [ ] **Tests** — No automated tests exist. Even basic smoke tests (syntax check + DOM structure verification) would prevent regressions.

### Pixel Baby

- [ ] **Fix character appearance** — Eyes, ponytail, smile issues documented in CLAUDE.md.
- [ ] **Re-integrate to main site** — Once character looks right, add peek-a-boo interaction back.
- [ ] **Reduce sprite code size** — Current canvas-based sprite system is complex. SVG might be simpler.
