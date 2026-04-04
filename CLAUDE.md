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
├── tests.html              # Test/preview page for pixel art characters (WIP)
├── CLAUDE.md               # This file
├── css/
│   ├── styles.css          # All main site styles (~2000 lines)
│   ├── pixel-baby.css      # Pixel art baby character styles (not loaded in main)
│   └── pixel-baby-tests.css # Test page styles (WIP)
├── js/
│   ├── app.js              # All main app logic (~1700 lines)
│   ├── pixel-baby.js       # Pixel art baby character code (not loaded in main)
│   └── pixel-baby-tests.js # Test page scripts (WIP)
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
8. **Trends Section** - Growth chart (SVG), stat card with Lucide trending-up icon
9. **Word Edit Modal** - View/edit word details, evolution chain linking
10. **Evolution Chain Modal** - Full chain view with reorder controls
11. **Footer** - Copyright, export button, test page link

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
- Sticky nav bar between input section and words section
- Two section tabs: "אוצר מילים" (words) and "מגמות" (trends)
- "+ הוסיפו מילה" button scrolls to input and focuses it
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
- Cache-bust JS files with `?v=N` query parameter
- The site uses IntersectionObserver for scroll-reveal animations
- Fuzzy search uses Levenshtein distance algorithm
- Timeline is vertical (flex-direction: column) with horizontal scroll for the age overlay
- Always test on mobile viewport (~375px width) as the site is mobile-first (max-width: 600px)

## Git Workflow
- Main branch: `main`
- Feature branches: `claude/*` naming convention
- Push to main for deployment (GitHub Pages auto-deploys)
