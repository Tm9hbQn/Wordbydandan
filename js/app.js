/* ===== Configuration ===== */
const SUPABASE_URL = 'https://hxhyaumawnmsbqwediqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aHlhdW1hd25tc2Jxd2VkaXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDI2ODAsImV4cCI6MjA5MDgxODY4MH0.NEXiKaMfI_PS6LxyiYHSzHOqsOBHTuHICLDErVNJckY';

const BABY_BIRTHDAY = new Date(2024, 11, 5); // December 5, 2024
const BABY_NAME = 'דניאלה';

/* ===== Supabase Client ===== */
// NOTE: Cannot use "supabase" as variable name - conflicts with SDK's global var supabase
let db = null;

function initSupabase() {
  try {
    if (!window.supabase) {
      console.error('Supabase SDK failed to load');
      return;
    }
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase connected');
  } catch (e) {
    console.error('Supabase init failed:', e);
    db = null;
  }
}

/* ===== Local Storage Fallback ===== */
const LS_KEY = 'daniella_words';

function getLocalWords() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalWords(words) {
  localStorage.setItem(LS_KEY, JSON.stringify(words));
}

/* ===== Database Operations ===== */
async function fetchWords() {
  if (!db) {
    return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  try {
    const { data, error } = await db
      .from('words')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch error:', error.message);
      return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    // Sync remote data to localStorage as backup
    if (data) saveLocalWords(data);
    return data || [];
  } catch (e) {
    console.error('Fetch words failed:', e);
    return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

async function insertWord(word) {
  const localFallback = () => {
    const words = getLocalWords();
    const newWord = {
      id: crypto.randomUUID(),
      ...word,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    words.push(newWord);
    saveLocalWords(words);
    return newWord;
  };

  if (!db) return localFallback();

  try {
    const { data, error } = await db.from('words').insert(word).select().single();
    if (error) {
      console.error('Supabase insert error:', error.message);
      return localFallback();
    }
    return data;
  } catch (e) {
    console.error('Insert word failed:', e);
    return localFallback();
  }
}

async function updateWord(id, updates) {
  if (!db) {
    const words = getLocalWords();
    const idx = words.findIndex((w) => w.id === id);
    if (idx >= 0) {
      words[idx] = { ...words[idx], ...updates, updated_at: new Date().toISOString() };
      saveLocalWords(words);
      return words[idx];
    }
    return null;
  }
  try {
    const { data, error } = await db
      .from('words')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Update word failed:', e);
    // Fallback to localStorage
    const words = getLocalWords();
    const idx = words.findIndex((w) => w.id === id);
    if (idx >= 0) {
      words[idx] = { ...words[idx], ...updates, updated_at: new Date().toISOString() };
      saveLocalWords(words);
      return words[idx];
    }
    throw e;
  }
}

async function deleteWord(id) {
  if (!db) {
    const words = getLocalWords().filter((w) => w.id !== id);
    saveLocalWords(words);
    return;
  }
  try {
    const { error } = await db.from('words').delete().eq('id', id);
    if (error) throw error;
  } catch (e) {
    console.error('Delete word failed:', e);
    const words = getLocalWords().filter((w) => w.id !== id);
    saveLocalWords(words);
  }
}

/* ===== Age Helpers ===== */
function calculateCurrentAgeMonths() {
  const now = new Date();
  let months = (now.getFullYear() - BABY_BIRTHDAY.getFullYear()) * 12;
  months += now.getMonth() - BABY_BIRTHDAY.getMonth();
  if (now.getDate() < BABY_BIRTHDAY.getDate()) months--;
  return Math.max(0, months);
}

function ageMonthsToHebrew(months) {
  if (months === 0) return 'לידה';
  if (months < 12) {
    return hebrewMonths(months);
  }
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let text = hebrewYears(years);
  if (remainingMonths > 0) {
    text += ' ו' + hebrewMonths(remainingMonths);
  }
  return text;
}

function hebrewMonths(m) {
  const names = [
    '',
    'חודש',
    'חודשיים',
    'שלושה חודשים',
    'ארבעה חודשים',
    'חמישה חודשים',
    'שישה חודשים',
    'שבעה חודשים',
    'שמונה חודשים',
    'תשעה חודשים',
    'עשרה חודשים',
    'אחד עשר חודשים',
  ];
  return names[m] || `${m} חודשים`;
}

function hebrewYears(y) {
  if (y === 1) return 'שנה';
  if (y === 2) return 'שנתיים';
  return `${y} שנים`;
}

/* ===== State ===== */
let currentWord = '';
let currentAgeMonths = null;
let editingWordId = null;
let words = [];
let submitting = false;

/* ===== DOM Elements ===== */
const $ = (sel) => document.querySelector(sel);
const wordInput = $('#wordInput');
const addBtn = $('#addBtn');
const inputSection = $('#inputSection');
const ageSection = $('#ageSection');
const ageQuestion = $('#ageQuestion');
const ageOptions = $('#ageOptions');
const justNowBtn = $('#justNowBtn');
const notesSection = $('#notesSection');
const notesTitle = $('#notesTitle');
const notesInput = $('#notesInput');
const notesSkipBtn = $('#notesSkipBtn');
const notesSaveBtn = $('#notesSaveBtn');
const successOverlay = $('#successOverlay');
const successText = $('#successText');
const wordsGrid = $('#wordsGrid');
const wordCount = $('#wordCount');
const emptyState = $('#emptyState');
const editModal = $('#editModal');
const modalClose = $('#modalClose');
const editWordInput = $('#editWordInput');
const editAgePicker = $('#editAgePicker');
const editNotesInput = $('#editNotesInput');
const editDeleteBtn = $('#editDeleteBtn');
const editSaveBtn = $('#editSaveBtn');
const gridViewBtn = $('#gridViewBtn');
const timelineViewBtn = $('#timelineViewBtn');
const timelineWrapper = $('#timelineWrapper');
const timelineTrack = $('#timelineTrack');
const timelineAgeOverlay = $('#timelineAgeOverlay');
const timelineAgeText = $('#timelineAgeText');

const searchInput = $('#searchInput');
const searchClear = $('#searchClear');
const monthFilterPills = $('#monthFilterPills');
const categoryFilterPills = $('#categoryFilterPills');

let currentView = 'timeline';
let searchQuery = '';
let viewBeforeSearch = null; // remembers view before search auto-switched to grid
let addFlowLinkedTo = null; // linked_to for the add-word flow
let addFlowCategory = null; // cdi_category for add flow
let addFlowSubCategory = null; // sub_category for add flow
let addFlowEvoSource = null; // word object to exclude from duplicate check when adding evolution
let filterMonth = null; // selected age_months filter (null = all)
let filterCategory = null; // selected CDI category filter (null = all)
// Categories are stored directly in DB (cdi_category, sub_category columns)
let selectedGrowthMonth = null; // selected month in growth chart (for red dot)
let selectedNounBiasIndex = null; // selected index in noun bias chart (for red dot)

const CDI_CAT_LABELS = {
  general_nominals: 'שמות עצם כלליים',
  specific_nominals: 'שמות עצם ספציפיים',
  action_words: 'מילות פעולה',
  modifiers: 'מתארים',
  personal_social: 'אינטראקציה וחברה',
};

const CDI_CAT_COLORS = {
  general_nominals: '#6C5CE7',
  specific_nominals: '#FF6B9D',
  action_words: '#4DD0E1',
  modifiers: '#FFD93D',
  personal_social: '#CE93D8',
};

const CDI_SUB_CATEGORIES = {
  general_nominals: [
    { key: 'animals', label: 'חיות' },
    { key: 'food_drink', label: 'אוכל ושתייה' },
    { key: 'body_parts', label: 'גוף' },
    { key: 'clothing', label: 'ביגוד' },
    { key: 'household', label: 'בית' },
    { key: 'toys_and_routines', label: 'צעצועים' },
    { key: 'outside', label: 'חוץ' },
  ],
  specific_nominals: [
    { key: 'people', label: 'אנשים' },
  ],
  action_words: [
    { key: 'actions', label: 'פעולות' },
  ],
  modifiers: [
    { key: 'attributes', label: 'תכונות' },
  ],
  personal_social: [
    { key: 'routines_and_games', label: 'שגרה ומשחקים' },
    { key: 'sound_effects', label: 'אפקטי קול' },
    { key: 'assertions', label: 'ביטויים' },
  ],
};

/* ===== Category Picker Builder ===== */
function buildCategoryPicker(container, selectedCat, selectedSub, onChange) {
  container.innerHTML = '';

  const catRow = document.createElement('div');
  catRow.className = 'cat-picker-row';

  const catOrder = ['general_nominals', 'specific_nominals', 'personal_social', 'action_words', 'modifiers'];
  catOrder.forEach(key => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'cat-pill' + (selectedCat === key ? ' active' : '');
    pill.dataset.cat = key;
    pill.style.setProperty('--cat-color', CDI_CAT_COLORS[key]);
    pill.textContent = CDI_CAT_LABELS[key];
    pill.addEventListener('click', () => {
      catRow.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const newCat = key;
      buildSubCategoryPills(subRow, newCat, null);
      if (onChange) onChange(newCat, null);
    });
    catRow.appendChild(pill);
  });

  const subRow = document.createElement('div');
  subRow.className = 'subcat-picker-row';

  function buildSubCategoryPills(row, cat, activeSub) {
    row.innerHTML = '';
    if (!cat || !CDI_SUB_CATEGORIES[cat]) return;
    const subs = CDI_SUB_CATEGORIES[cat];
    if (subs.length <= 1) {
      // Auto-select single sub-category
      if (subs.length === 1 && onChange) onChange(cat, subs[0].key);
      return;
    }
    subs.forEach(sub => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'subcat-pill' + (activeSub === sub.key ? ' active' : '');
      pill.dataset.sub = sub.key;
      pill.textContent = sub.label;
      pill.addEventListener('click', () => {
        row.querySelectorAll('.subcat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (onChange) onChange(cat, sub.key);
      });
      row.appendChild(pill);
    });
  }

  container.appendChild(catRow);
  container.appendChild(subRow);

  if (selectedCat) {
    buildSubCategoryPills(subRow, selectedCat, selectedSub);
  }
}

/* ===== Initialize ===== */
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  setupEventListeners();
  buildAgeOptions(ageOptions, null);
  await loadWords();

  // Render vocabulary charts from DB data
  if (window.VocabCharts) VocabCharts.render(words);

  // PWA: service worker, install prompt, realtime, push
  initPWA();

  // Debug: show connection status in console
  console.log('[WordByDandan] supabase client:', db ? 'connected' : 'MISSING');
  console.log('[WordByDandan] words loaded:', words.length);
  console.log('[WordByDandan] window.supabase SDK:', typeof window.supabase);
});

/* ===== Event Listeners ===== */
function setupEventListeners() {
  // Word input
  wordInput.addEventListener('input', onWordInput);
  wordInput.addEventListener('focus', onWordFocus);
  wordInput.addEventListener('blur', onWordBlur);
  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (wordInput.value.trim()) submitWord();
    }
  });

  // Add button
  addBtn.addEventListener('click', () => submitWord());

  // Age picker
  const ageConfirmBtn = $('#ageConfirmBtn');
  ageConfirmBtn.addEventListener('click', () => {
    const months = getWheelCenterMonth(ageOptions);
    selectAge(months);
  });
  justNowBtn.addEventListener('click', () => selectAge(calculateCurrentAgeMonths()));

  // Notes
  notesSkipBtn.addEventListener('click', () => saveNewWord(''));
  notesSaveBtn.addEventListener('click', () => saveNewWord(getInputText(notesInput).trim()));

  notesInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  notesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNewWord(getInputText(notesInput).trim());
    }
  });

  // Word modal
  modalClose.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
  editToggleBtn.addEventListener('click', switchToEditMode);
  editCancelBtn.addEventListener('click', switchToViewMode);
  editDeleteBtn.addEventListener('click', handleDelete);
  editSaveBtn.addEventListener('click', handleEditSave);
  document.getElementById('addEvoBtn').addEventListener('click', handleAddEvolution);

  editWordInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  editNotesInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Evolution chain modal
  evoModalClose.addEventListener('click', closeEvoModal);
  evoDoneBtn.addEventListener('click', closeEvoModal);
  evoModal.addEventListener('click', (e) => {
    if (e.target === evoModal) closeEvoModal();
  });

  // View toggle
  if (gridViewBtn) gridViewBtn.addEventListener('click', () => switchView('grid'));
  if (timelineViewBtn) timelineViewBtn.addEventListener('click', () => switchView('timeline'));

  // Word linking in edit modal
  linkSearchInput.addEventListener('input', () => {
    const q = linkSearchInput.value.trim();
    if (!q) {
      linkResults.classList.add('hidden');
      return;
    }
    // Simple search: substring match on word name, then fuzzy fallback
    const matches = words.filter((w) => {
      if (w.id === editingWordId) return false;
      const wordLower = w.word.toLowerCase();
      const qLower = q.toLowerCase();
      if (wordLower.includes(qLower) || qLower.includes(wordLower)) return true;
      return fuzzyMatchWord(q, w);
    }).slice(0, 8);

    linkResults.innerHTML = '';
    if (matches.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'link-result-item';
      noResult.style.opacity = '0.5';
      noResult.style.cursor = 'default';
      noResult.textContent = 'לא נמצאו מילים';
      linkResults.appendChild(noResult);
      linkResults.classList.remove('hidden');
      return;
    }
    matches.forEach((w) => {
      const item = document.createElement('div');
      item.className = 'link-result-item';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = w.word;
      const ageSpan = document.createElement('span');
      ageSpan.className = 'link-result-age';
      ageSpan.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';
      item.appendChild(nameSpan);
      item.appendChild(ageSpan);
      item.addEventListener('mousedown', (e) => {
        // Use mousedown instead of click to fire before blur
        e.preventDefault();
        editingLinkedTo = w.id;
        updateLinkUI();
        linkSearchInput.value = '';
        linkResults.classList.add('hidden');
      });
      linkResults.appendChild(item);
    });
    linkResults.classList.remove('hidden');
  });

  linkSearchInput.addEventListener('focus', () => {
    // Scroll the modal so the input is near the top, leaving room for results above keyboard
    setTimeout(() => {
      const modalContent = linkSearchInput.closest('.modal-content');
      if (modalContent) {
        // Scroll the link field to the top of the modal's visible area
        const field = linkSearchInput.closest('.modal-field') || linkSearchInput;
        const fieldTop = field.offsetTop;
        modalContent.scrollTo({ top: fieldTop - 10, behavior: 'smooth' });
      }
    }, 350);
  });

  linkSearchInput.addEventListener('blur', () => {
    // Longer delay for mobile to allow tap on results
    setTimeout(() => linkResults.classList.add('hidden'), 400);
  });

  linkRemoveBtn.addEventListener('click', () => {
    editingLinkedTo = null;
    updateLinkUI();
  });

  // Search - auto-switch to grid, relevance sorting
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !searchQuery);
    if (searchQuery && viewBeforeSearch === null) {
      viewBeforeSearch = currentView;
      if (currentView !== 'grid') switchView('grid');
    }
    if (!searchQuery && viewBeforeSearch !== null) {
      switchView(viewBeforeSearch);
      viewBeforeSearch = null;
    }
    renderWords();
    if (searchQuery) {
      setTimeout(() => {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    if (viewBeforeSearch !== null) {
      switchView(viewBeforeSearch);
      viewBeforeSearch = null;
    }
    renderWords();
  });

  // Filter toggles
  const monthFilterToggle = document.getElementById('monthFilterToggle');
  const categoryFilterToggle = document.getElementById('categoryFilterToggle');
  const monthFilterGroup = document.getElementById('monthFilterGroup');
  const categoryFilterGroup = document.getElementById('categoryFilterGroup');

  if (monthFilterToggle) {
    monthFilterToggle.addEventListener('click', () => {
      const isOpen = !monthFilterGroup.classList.contains('collapsed');
      monthFilterGroup.classList.toggle('collapsed', isOpen);
      monthFilterToggle.classList.toggle('active', !isOpen);
    });
  }
  if (categoryFilterToggle) {
    categoryFilterToggle.addEventListener('click', () => {
      const isOpen = !categoryFilterGroup.classList.contains('collapsed');
      categoryFilterGroup.classList.toggle('collapsed', isOpen);
      categoryFilterToggle.classList.toggle('active', !isOpen);
    });
  }

  // Timeline scroll - listen on the scroll container
  const timelineScroll = $('#timelineScroll');
  if (timelineScroll) {
    timelineScroll.addEventListener('scroll', onTimelineScroll, { passive: true });

    // Allow page scroll when timeline is at top/bottom boundary
    let lastTouchY = 0;
    timelineScroll.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    timelineScroll.addEventListener('touchmove', (e) => {
      const dy = lastTouchY - e.touches[0].clientY; // positive = scrolling down
      const atTop = timelineScroll.scrollTop <= 0;
      const atBottom = timelineScroll.scrollTop + timelineScroll.clientHeight >= timelineScroll.scrollHeight - 1;

      if ((atTop && dy < 0) || (atBottom && dy > 0)) {
        // At boundary, let the page scroll by briefly disabling timeline overflow
        timelineScroll.style.overflowY = 'hidden';
        requestAnimationFrame(() => {
          timelineScroll.style.overflowY = 'auto';
        });
      }
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });
  }
}

/* ===== Input Handling ===== */
function getInputText(el) {
  return el.textContent || el.innerText || '';
}

function onWordInput() {
  // No-op, button is always visible
}

function onWordFocus() {
  document.body.classList.add('input-focused');

  // Scroll input into view above keyboard
  setTimeout(() => {
    inputSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function onWordBlur() {
  document.body.classList.remove('input-focused');
}

/* ===== Duplicate Detection ===== */
function findSimilarWords(text, excludeIds) {
  const q = text.toLowerCase();
  const exclude = excludeIds ? new Set(excludeIds) : new Set();
  return words.filter((w) => {
    if (exclude.has(w.id)) return false;
    const wl = w.word.toLowerCase();
    if (wl === q) return true;
    if (wl.includes(q) || q.includes(wl)) return true;
    if (q.length >= 2 && wl.length >= 2 && levenshtein(q, wl) <= (q.length <= 3 ? 1 : 2)) return true;
    return false;
  }).slice(0, 5);
}

function showDuplicateModal(text, similar) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay duplicate-modal-overlay';
    const content = document.createElement('div');
    content.className = 'modal-content duplicate-modal-content';
    content.innerHTML = `
      <h3 class="modal-title">מילה דומה כבר קיימת 🤔</h3>
      <p style="font-family:Varela Round,sans-serif;color:var(--deep-purple);margin-bottom:1rem;text-align:center;">
        מצאנו מילים דומות ל-"<strong>${text}</strong>":
      </p>
      <div class="duplicate-list"></div>
      <div class="duplicate-actions">
        <button class="duplicate-continue-btn">להוסיף בכל זאת ✨</button>
      </div>
    `;
    const list = content.querySelector('.duplicate-list');
    similar.forEach((w) => {
      const item = document.createElement('div');
      item.className = 'duplicate-item';
      item.innerHTML = `<span class="duplicate-word">${w.word}</span><span class="duplicate-age">${w.age_months !== null ? ageMonthsToHebrew(w.age_months) : ''}</span>`;
      item.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.body.style.overflow = '';
        resolve({ action: 'view', word: w });
      });
      list.appendChild(item);
    });
    content.querySelector('.duplicate-continue-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
      resolve('continue');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        document.body.style.overflow = '';
        resolve('cancel');
      }
    });
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  });
}

/* ===== Submit Word Flow ===== */
async function submitWord() {
  if (submitting) return;
  const text = wordInput.value.trim();
  if (!text) return;
  submitting = true;

  // Check for duplicates (exclude evo source word if adding evolution)
  const excludeIds = addFlowEvoSource ? [addFlowEvoSource.id] : [];
  const similar = findSimilarWords(text, excludeIds);
  if (similar.length > 0) {
    const result = await showDuplicateModal(text, similar);
    if (result === 'cancel') {
      addFlowEvoSource = null;
      submitting = false;
      return;
    }
    if (result && result.action === 'view') {
      addFlowEvoSource = null;
      submitting = false;
      openEditModal(result.word);
      return;
    }
  }

  currentWord = text;

  // Swish out input section
  const markerArea = document.querySelector('.marker-area');
  markerArea.classList.add('swish-out');

  setTimeout(() => {
    inputSection.classList.add('hidden');
    markerArea.classList.remove('swish-out');

    // Show age section
    ageQuestion.textContent = `מתי ${BABY_NAME} אמרה "${currentWord}" בפעם הראשונה?`;
    ageSection.classList.remove('hidden');
    ageSection.querySelector('.age-container').classList.add('swish-in');

    // Reset age selection
    currentAgeMonths = null;
    ageOptions.querySelectorAll('.age-option').forEach((o) => o.classList.remove('selected'));
  }, 400);
}

function selectAge(months) {
  currentAgeMonths = months;

  // Highlight selected in main age picker
  ageOptions.querySelectorAll('.age-option').forEach((o) => {
    o.classList.toggle('selected', parseInt(o.dataset.months) === months);
  });

  // Swish out age section, show notes
  const container = ageSection.querySelector('.age-container');
  container.classList.add('swish-out');

  setTimeout(() => {
    ageSection.classList.add('hidden');
    container.classList.remove('swish-out', 'swish-in');

    // Show notes
    notesTitle.textContent = `רוצים להוסיף הקשר ל"${currentWord}"? 📝`;
    notesInput.textContent = '';
    addFlowLinkedTo = null;
    addFlowCategory = null;
    addFlowSubCategory = null;
    setupAddFlowLinking();
    // Auto-link if adding evolution from a word card
    if (addFlowEvoSource) {
      addFlowLinkedTo = addFlowEvoSource.id;
      const checkbox = document.getElementById('addFlowLinkCheckbox');
      const linkSearch = document.getElementById('addFlowLinkSearch');
      const linkCurrentWrap = document.getElementById('addFlowLinkCurrent');
      const linkBadgeEl = document.getElementById('addFlowLinkBadge');
      const linkInputWrap = document.getElementById('addFlowSearchWrap');
      if (checkbox) checkbox.checked = true;
      if (linkSearch) linkSearch.classList.remove('hidden');
      if (linkBadgeEl) linkBadgeEl.textContent = addFlowEvoSource.word;
      if (linkCurrentWrap) linkCurrentWrap.classList.remove('hidden');
      if (linkInputWrap) linkInputWrap.classList.add('hidden');
    }
    // Init category picker in add flow
    const addCatContainer = document.getElementById('addFlowCatPickerContainer');
    if (addCatContainer) {
      // Start with no pre-selected category (user picks manually)
      buildCategoryPicker(addCatContainer, null, null, (cat, sub) => {
        addFlowCategory = cat;
        addFlowSubCategory = sub;
      });
    }
    notesSection.classList.remove('hidden');
    notesSection.querySelector('.notes-container').classList.add('fade-in');
  }, 400);
}

function setupAddFlowLinking() {
  const checkbox = document.getElementById('addFlowLinkCheckbox');
  const searchWrap = document.getElementById('addFlowLinkSearch');
  const searchInput = document.getElementById('addFlowSearchInput');
  const searchResults = document.getElementById('addFlowSearchResults');
  const currentWrap = document.getElementById('addFlowLinkCurrent');
  const badge = document.getElementById('addFlowLinkBadge');
  const removeBtn = document.getElementById('addFlowLinkRemove');
  const inputWrap = document.getElementById('addFlowSearchWrap');
  if (!checkbox || !searchWrap || !searchInput) return;

  checkbox.checked = false;
  searchWrap.classList.add('hidden');
  searchInput.value = '';
  searchResults.classList.add('hidden');
  currentWrap.classList.add('hidden');
  inputWrap.classList.remove('hidden');
  addFlowLinkedTo = null;

  function updateAddFlowLinkUI() {
    if (addFlowLinkedTo) {
      const linked = words.find(w => w.id === addFlowLinkedTo);
      if (linked) {
        badge.textContent = linked.word;
        currentWrap.classList.remove('hidden');
        inputWrap.classList.add('hidden');
      }
    } else {
      currentWrap.classList.add('hidden');
      inputWrap.classList.remove('hidden');
      searchInput.value = '';
    }
  }

  checkbox.onchange = () => {
    if (checkbox.checked) {
      searchWrap.classList.remove('hidden');
      addFlowLinkedTo = null;
      updateAddFlowLinkUI();
      setTimeout(() => searchInput.focus(), 100);
    } else {
      searchWrap.classList.add('hidden');
      addFlowLinkedTo = null;
      searchInput.value = '';
      searchResults.classList.add('hidden');
    }
  };

  removeBtn.onclick = () => {
    addFlowLinkedTo = null;
    updateAddFlowLinkUI();
    setTimeout(() => searchInput.focus(), 100);
  };

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) {
      searchResults.classList.add('hidden');
      return;
    }
    const matches = words.filter(w => {
      const wLower = w.word.toLowerCase();
      const qLower = q.toLowerCase();
      if (wLower.includes(qLower) || qLower.includes(wLower)) return true;
      return fuzzyMatchWord(q, w);
    }).slice(0, 8);

    searchResults.innerHTML = '';
    if (matches.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'link-result-item';
      noResult.style.opacity = '0.5';
      noResult.style.cursor = 'default';
      noResult.textContent = 'לא נמצאו מילים';
      searchResults.appendChild(noResult);
      searchResults.classList.remove('hidden');
      return;
    }
    matches.forEach(w => {
      const item = document.createElement('div');
      item.className = 'link-result-item';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = w.word;
      const ageSpan = document.createElement('span');
      ageSpan.className = 'link-result-age';
      ageSpan.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';
      item.appendChild(nameSpan);
      item.appendChild(ageSpan);
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addFlowLinkedTo = w.id;
        searchResults.classList.add('hidden');
        updateAddFlowLinkUI();
      });
      searchResults.appendChild(item);
    });
    searchResults.classList.remove('hidden');
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => searchResults.classList.add('hidden'), 400);
  });
}

async function saveNewWord(notes) {
  const container = notesSection.querySelector('.notes-container');
  container.classList.add('fade-out');

  setTimeout(async () => {
    notesSection.classList.add('hidden');
    container.classList.remove('fade-out', 'fade-in');

    try {
      const wordData = {
        word: currentWord,
        age_months: currentAgeMonths,
        notes: notes || null,
      };
      if (addFlowLinkedTo) {
        wordData.linked_to = addFlowLinkedTo;
      }
      if (addFlowCategory) {
        wordData.cdi_category = addFlowCategory;
      }
      if (addFlowSubCategory) {
        wordData.sub_category = addFlowSubCategory;
      }
      await insertWord(wordData);

      showSuccess(`"${currentWord}" נוספה! 🌟`);
      await loadWords();
    } catch (err) {
      console.error('Error saving word:', err);
      showSuccess('אופס, משהו השתבש 😅');
    } finally {
      addFlowLinkedTo = null;
      addFlowCategory = null;
      addFlowSubCategory = null;
      addFlowEvoSource = null;
      resetInput();
    }
  }, 300);
}

function resetInput() {
  wordInput.value = '';
  currentWord = '';
  currentAgeMonths = null;
  submitting = false;
  inputSection.classList.remove('hidden');
}

function showSuccess(text) {
  successText.textContent = text;
  successOverlay.classList.add('hidden');
  successOverlay.classList.remove('toast-hiding');
  // Force reflow to restart animation
  void successOverlay.offsetWidth;
  successOverlay.classList.remove('hidden');

  clearTimeout(showSuccess._timer);
  showSuccess._timer = setTimeout(() => {
    successOverlay.classList.add('toast-hiding');
    setTimeout(() => {
      successOverlay.classList.add('hidden');
      successOverlay.classList.remove('toast-hiding');
    }, 300);
  }, 2000);
}

/* ===== Age Options Builder ===== */
function buildAgeOptions(container, selectedMonths) {
  container.innerHTML = '';
  const maxMonths = calculateCurrentAgeMonths();
  const isWheel = container === ageOptions;

  // Build options from newest to oldest
  for (let m = maxMonths; m >= 0; m--) {
    const btn = document.createElement('button');
    btn.className = 'age-option' + (m === selectedMonths ? ' selected' : '');
    btn.textContent = ageMonthsToHebrew(m);
    btn.dataset.months = m;
    btn.addEventListener('click', () => {
      if (isWheel) {
        // Scroll this item to center (user confirms with the button)
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        container.querySelectorAll('.age-option').forEach((o) => o.classList.remove('selected'));
        btn.classList.add('selected');
      }
    });
    container.appendChild(btn);
  }

  // Set up wheel scroll behavior for the main age picker
  if (isWheel) {
    setupAgeWheel(container);
  }
}

function getWheelCenterMonth(wheel) {
  const items = wheel.querySelectorAll('.age-option');
  const wheelRect = wheel.getBoundingClientRect();
  const centerY = wheelRect.top + wheelRect.height / 2;
  let closest = null;
  let closestDist = Infinity;

  items.forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const itemCenter = itemRect.top + itemRect.height / 2;
    const dist = Math.abs(itemCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closest = item;
    }
  });

  return closest ? parseInt(closest.dataset.months) : 0;
}

function setupAgeWheel(wheel) {
  let scrollRaf = null;

  function updateWheelHighlight() {
    const items = wheel.querySelectorAll('.age-option');
    const wheelRect = wheel.getBoundingClientRect();
    const centerY = wheelRect.top + wheelRect.height / 2;

    items.forEach((item) => {
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.top + itemRect.height / 2;
      const dist = Math.abs(itemCenter - centerY);

      item.classList.remove('wheel-center', 'wheel-near');
      if (dist < 24) {
        item.classList.add('wheel-center');
      } else if (dist < 72) {
        item.classList.add('wheel-near');
      }
    });
  }

  wheel.addEventListener('scroll', () => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(updateWheelHighlight);
  }, { passive: true });

  // Initial highlight after render
  requestAnimationFrame(() => {
    updateWheelHighlight();
  });
}

/* ===== Fuzzy Search ===== */
function fuzzyMatch(query, text) {
  if (!query) return true;
  query = query.toLowerCase();
  text = text.toLowerCase();

  // Exact substring
  if (text.includes(query)) return true;

  // Check if query chars appear in order (fuzzy)
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++;
  }
  if (qi === query.length) return true;

  // Levenshtein distance for short strings — allow typos
  if (query.length >= 2 && text.length >= 2) {
    const maxDist = query.length <= 3 ? 1 : 2;
    if (levenshtein(query, text) <= maxDist) return true;
    // Also check each word in notes
  }

  // Check if query is a subsequence with at most 1 skip
  return false;
}

function fuzzyMatchWord(query, wordObj) {
  if (!query) return true;
  if (fuzzyMatch(query, wordObj.word)) return true;
  if (wordObj.notes && fuzzyMatch(query, wordObj.notes)) return true;
  return false;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return Math.max(m, n); // quick exit
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

function getSearchRelevance(query, wordObj) {
  if (!query) return { match: true, score: 0 };
  const q = query.toLowerCase();
  const w = wordObj.word.toLowerCase();
  // Exact match
  if (w === q) return { match: true, score: 4 };
  // Starts with
  if (w.startsWith(q)) return { match: true, score: 3 };
  // Contains
  if (w.includes(q)) return { match: true, score: 2 };
  // Notes contain
  if (wordObj.notes && wordObj.notes.toLowerCase().includes(q)) return { match: true, score: 1 };
  // Fuzzy
  if (fuzzyMatchWord(query, wordObj)) return { match: true, score: 0 };
  return { match: false, score: -1 };
}

function getFilteredWords() {
  let result = words;

  // Apply month filter
  if (filterMonth !== null) {
    result = result.filter((w) => w.age_months === filterMonth);
  }

  // Apply category filter
  if (filterCategory !== null) {
    result = result.filter((w) => {
      const cat = getWordCategory(w);
      return cat === filterCategory;
    });
  }

  // Apply search
  if (!searchQuery) return result;
  const scored = [];
  result.forEach((w) => {
    const rel = getSearchRelevance(searchQuery, w);
    if (rel.match) scored.push({ word: w, score: rel.score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((r) => r.word);
}

/* ===== Category Helpers (data from DB cdi_category/sub_category columns) ===== */

function getWordCategory(wordOrText) {
  if (typeof wordOrText === 'object' && wordOrText.cdi_category && wordOrText.cdi_category !== 'unclear') {
    return wordOrText.cdi_category;
  }
  return null;
}

function getWordCategoryFromObj(w) {
  if (w.cdi_category && w.cdi_category !== 'unclear') return w.cdi_category;
  return null;
}

/* ===== Filter Pills ===== */
function buildFilterPills() {
  // Month pills — only months that have words
  const monthSet = new Set();
  words.forEach((w) => {
    if (w.age_months !== null && w.age_months !== undefined) {
      monthSet.add(w.age_months);
    }
  });
  const months = [...monthSet].sort((a, b) => a - b);

  monthFilterPills.innerHTML = '';
  months.forEach((m) => {
    const pill = document.createElement('button');
    pill.className = 'filter-pill' + (filterMonth === m ? ' active' : '');
    pill.textContent = ageMonthsToHebrew(m);
    pill.addEventListener('click', () => {
      filterMonth = filterMonth === m ? null : m;
      buildFilterPills();
      renderWords();
    });
    monthFilterPills.appendChild(pill);
  });

  // Category pills — only categories that exist in vocabulary data for current words
  const catSet = new Set();
  words.forEach((w) => {
    const cat = getWordCategory(w);
    if (cat) catSet.add(cat);
  });

  const catOrder = ['general_nominals', 'specific_nominals', 'personal_social', 'action_words', 'modifiers'];
  const cats = catOrder.filter((c) => catSet.has(c));

  categoryFilterPills.innerHTML = '';
  cats.forEach((c) => {
    const pill = document.createElement('button');
    pill.className = 'filter-pill' + (filterCategory === c ? ' active' : '');
    pill.style.setProperty('--pill-color', CDI_CAT_COLORS[c]);
    pill.textContent = CDI_CAT_LABELS[c];
    pill.addEventListener('click', () => {
      filterCategory = filterCategory === c ? null : c;
      buildFilterPills();
      renderWords();
    });
    categoryFilterPills.appendChild(pill);
  });

  // Update toggle button states to reflect active filters
  const monthToggle = document.getElementById('monthFilterToggle');
  const catToggle = document.getElementById('categoryFilterToggle');
  if (monthToggle) monthToggle.classList.toggle('has-active-filter', filterMonth !== null);
  if (catToggle) catToggle.classList.toggle('has-active-filter', filterCategory !== null);
}

/* ===== Load & Render Words ===== */
async function loadWords() {
  try {
    words = await fetchWords();
    buildFilterPills();
    renderWords();
    // Re-render vocabulary charts from DB data
    if (window.VocabCharts) VocabCharts.render(words);
  } catch (err) {
    console.error('Error loading words:', err);
  }
}

function renderWords() {
  // Reset timeline pagination when re-rendering (new word added, search, etc.)
  timelineDisplayCount = 10;
  wordsGrid.innerHTML = '';
  const filtered = getFilteredWords();

  if (words.length === 0) {
    emptyState.classList.remove('hidden');
    wordCount.textContent = '0';
    return;
  }

  emptyState.classList.add('hidden');
  // Count unique words: words that have linked_to are earlier pronunciations, not new words
  const uniqueCount = words.filter((w) => !w.linked_to).length;
  animateCount(wordCount, uniqueCount);

  if (filtered.length === 0 && searchQuery) {
    wordsGrid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--soft-purple);font-family:Varela Round,sans-serif;">לא נמצאו תוצאות 🤷</div>';
  }

  filtered.forEach((w, i) => {
    const card = document.createElement('div');
    card.className = 'word-card reveal-on-scroll';
    if (searchQuery && w.word.toLowerCase() === searchQuery.toLowerCase()) {
      card.classList.add('word-card-exact-match');
    }
    card.style.setProperty('--reveal-delay', `${Math.min(i * 0.06, 0.5)}s`);
    const cat = getWordCategory(w);
    if (cat && CDI_CAT_COLORS[cat]) {
      card.style.setProperty('--card-accent', CDI_CAT_COLORS[cat]);
      card.classList.add('word-card-categorized');
    }
    card.addEventListener('click', () => openEditModal(w));

    const wordEl = document.createElement('div');
    wordEl.className = 'word-card-word';
    wordEl.textContent = w.word;

    const ageEl = document.createElement('div');
    ageEl.className = 'word-card-age';
    ageEl.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';

    card.appendChild(wordEl);
    card.appendChild(ageEl);

    if (w.notes) {
      const notesEl = document.createElement('div');
      notesEl.className = 'word-card-notes';
      notesEl.textContent = w.notes;
      card.appendChild(notesEl);
    }

    // Show link if this word is part of any chain
    const hasLink = w.linked_to || words.some((o) => o.linked_to === w.id);
    if (hasLink) {
      const chain = getEvolutionChain(w.id);
      if (chain.length > 1) {
        const linkEl = document.createElement('div');
        linkEl.className = 'word-card-link';
        linkEl.textContent = chain.map((c) => c.word).join(' ← ');
        linkEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openEvoModal(w.id);
        });
        card.appendChild(linkEl);
      }
    }

    wordsGrid.appendChild(card);
  });

  if (currentView === 'timeline') {
    renderTimeline();
  }

  // Observe all new cards for scroll-reveal
  requestAnimationFrame(() => observeRevealElements());

  // Render trends chart
  renderTrends();
}

/* ===== Animated Counter ===== */
function animateCount(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;
  el.classList.add('count-bump');
  setTimeout(() => el.classList.remove('count-bump'), 300);
  const duration = 400;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = Math.round(current + (target - current) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ===== Scroll Reveal Observer ===== */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.05, rootMargin: '100px 0px 100px 0px' }
);

let timelineRevealObserver = null;

function getTimelineObserver() {
  if (timelineRevealObserver) return timelineRevealObserver;
  const scrollContainer = document.querySelector('#timelineScroll');
  if (!scrollContainer) return revealObserver;
  timelineRevealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          timelineRevealObserver.unobserve(entry.target);
        }
      });
    },
    { root: scrollContainer, threshold: 0.05, rootMargin: '100px 0px 100px 0px' }
  );
  return timelineRevealObserver;
}

function observeRevealElements() {
  const els = document.querySelectorAll('.reveal-on-scroll:not(.revealed)');
  const tlObserver = getTimelineObserver();
  els.forEach((el) => {
    if (el.closest('#timelineTrack')) {
      tlObserver.observe(el);
    } else {
      revealObserver.observe(el);
    }
  });
  // Safety: reveal any items the observer missed after 1.5s
  setTimeout(() => {
    document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach((el) => {
      el.classList.add('revealed');
    });
  }, 1500);
}

/* ===== Edit Modal ===== */
let editingLinkedTo = null;

const linkSection = $('#linkSection');
const linkCurrent = $('#linkCurrent');
const linkBadge = $('#linkBadge');
const linkRemoveBtn = $('#linkRemoveBtn');
const linkSearchInput = $('#linkSearchInput');
const linkResults = $('#linkResults');
const linkSearchWrap = $('#linkSearchWrap');

const wordViewMode = $('#wordViewMode');
const wordEditMode = $('#wordEditMode');
const viewWordDisplay = $('#viewWordDisplay');
const viewAgeDisplay = $('#viewAgeDisplay');
const viewCategoryDisplay = $('#viewCategoryDisplay');
const viewNotesDisplay = $('#viewNotesDisplay');
const viewEvoSection = $('#viewEvoSection');
const viewEvoChain = $('#viewEvoChain');
const editToggleBtn = $('#editToggleBtn');
const editCancelBtn = $('#editCancelBtn');
let viewingWord = null;

function openEditModal(word) {
  viewingWord = word;
  editingWordId = word.id;
  editingLinkedTo = word.linked_to || null;

  // Populate view mode
  viewWordDisplay.textContent = word.word;
  viewAgeDisplay.textContent = word.age_months !== null ? ageMonthsToHebrew(word.age_months) : '';

  // Show category if exists
  const wordCat = getWordCategoryFromObj(word);
  if (wordCat && CDI_CAT_LABELS[wordCat]) {
    viewCategoryDisplay.innerHTML = '';
    const catBadge = document.createElement('span');
    catBadge.className = 'view-cat-badge';
    catBadge.style.setProperty('--cat-color', CDI_CAT_COLORS[wordCat]);
    catBadge.textContent = CDI_CAT_LABELS[wordCat];
    viewCategoryDisplay.appendChild(catBadge);
    // Show sub-category too if available
    const subCat = word.sub_category;
    if (subCat && subCat !== 'unclear') {
      const allSubs = CDI_SUB_CATEGORIES[wordCat] || [];
      const subInfo = allSubs.find(s => s.key === subCat);
      if (subInfo) {
        const subBadge = document.createElement('span');
        subBadge.className = 'view-subcat-badge';
        subBadge.textContent = subInfo.label;
        viewCategoryDisplay.appendChild(subBadge);
      }
    }
    viewCategoryDisplay.classList.remove('hidden');
  } else {
    viewCategoryDisplay.classList.add('hidden');
  }

  if (word.notes) {
    viewNotesDisplay.textContent = word.notes;
    viewNotesDisplay.classList.remove('hidden');
  } else {
    viewNotesDisplay.classList.add('hidden');
  }

  // Show evolution chain if exists
  const chain = getEvolutionChain(word.id);
  if (chain.length > 1) {
    viewEvoSection.classList.remove('hidden');
    viewEvoChain.innerHTML = '';

    // Build horizontal mini-timeline for evolution chain
    const evoTimeline = document.createElement('div');
    evoTimeline.className = 'evo-mini-timeline';

    chain.forEach((w, i) => {
      // Word column with dot, word, and age
      const col = document.createElement('div');
      col.className = 'evo-mini-col' + (w.id === word.id ? ' evo-active' : '');
      col.addEventListener('click', () => {
        const target = words.find((o) => o.id === w.id);
        if (target && target.id !== word.id) {
          closeEditModal();
          openEditModal(target);
        }
      });

      const wordEl = document.createElement('div');
      wordEl.className = 'evo-mini-word';
      wordEl.textContent = w.word;

      const dot = document.createElement('div');
      dot.className = 'evo-mini-dot';

      const ageEl = document.createElement('div');
      ageEl.className = 'evo-mini-age';
      ageEl.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';

      col.appendChild(wordEl);
      col.appendChild(dot);
      col.appendChild(ageEl);
      evoTimeline.appendChild(col);

      // Arrow between items (RTL: → direction, youngest right to oldest left)
      if (i < chain.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'evo-mini-arrow';
        arrow.textContent = '←';
        evoTimeline.appendChild(arrow);
      }
    });

    viewEvoChain.appendChild(evoTimeline);
  } else {
    viewEvoSection.classList.add('hidden');
  }

  // Show view mode, hide edit mode
  wordViewMode.classList.remove('hidden');
  wordEditMode.classList.add('hidden');

  editModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function switchToEditMode() {
  if (!viewingWord) return;

  editWordInput.textContent = viewingWord.word;
  editNotesInput.textContent = viewingWord.notes || '';
  buildAgeOptions(editAgePicker, viewingWord.age_months);
  updateLinkUI();
  linkSearchInput.value = '';
  linkResults.classList.add('hidden');

  // Init category picker for edit modal
  const editCatContainer = document.getElementById('editCatPickerContainer');
  if (editCatContainer) {
    const curCat = viewingWord.cdi_category || null;
    const curSub = viewingWord.sub_category || null;
    buildCategoryPicker(editCatContainer, curCat !== 'unclear' ? curCat : null, curSub !== 'unclear' ? curSub : null, () => {});
  }

  wordViewMode.classList.add('hidden');
  wordEditMode.classList.remove('hidden');
}

function switchToViewMode() {
  // Refresh view from current word data
  const word = words.find((w) => w.id === editingWordId);
  if (word) {
    wordEditMode.classList.add('hidden');
    openEditModal(word);
  } else {
    closeEditModal();
  }
}

function updateLinkUI() {
  const linkedWord = editingLinkedTo ? words.find((w) => w.id === editingLinkedTo) : null;
  if (linkedWord) {
    linkBadge.textContent = linkedWord.word;
    linkBadge.onclick = () => {
      closeEditModal();
      openEvoModal(editingWordId);
    };
    linkCurrent.classList.remove('hidden');
  } else {
    linkCurrent.classList.add('hidden');
  }
}

function handleAddEvolution() {
  if (!viewingWord) return;
  const sourceWord = viewingWord;
  addFlowEvoSource = sourceWord;
  closeEditModal();
  // Focus the input and scroll to it
  wordInput.value = '';
  wordInput.focus();
  setTimeout(() => {
    inputSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
}

function closeEditModal() {
  // Remember which word was being viewed so we can scroll to it
  const lastViewedId = editingWordId;
  editModal.classList.add('hidden');
  document.body.style.overflow = '';
  editingWordId = null;
  editingLinkedTo = null;
  viewingWord = null;

  // Scroll timeline to the last viewed word (may differ from the original if user navigated via evolution chain)
  if (lastViewedId && currentView === 'timeline') {
    setTimeout(() => {
      let el = timelineTrack.querySelector(`[data-word-id="${lastViewedId}"]`);
      if (!el) {
        timelineDisplayCount = Infinity;
        renderTimeline();
        el = timelineTrack.querySelector(`[data-word-id="${lastViewedId}"]`);
      }
      if (el) {
        scrollToTimelineItem(el);
      }
    }, 100);
  }
}

async function handleEditSave() {
  const word = getInputText(editWordInput).trim();
  if (!word) return;

  const selectedAge = editAgePicker.querySelector('.age-option.selected');
  const ageMonths = selectedAge ? parseInt(selectedAge.dataset.months) : null;
  const notes = getInputText(editNotesInput).trim() || null;

  // Get category from edit modal
  const editCatSelected = editModal.querySelector('.cat-pill.active');
  const editCdiCategory = editCatSelected ? editCatSelected.dataset.cat : null;
  const editSubCatSelected = editModal.querySelector('.subcat-pill.active');
  const editSubCategory = editSubCatSelected ? editSubCatSelected.dataset.sub : null;

  try {
    await updateWord(editingWordId, {
      word,
      age_months: ageMonths,
      notes,
      linked_to: editingLinkedTo,
      cdi_category: editCdiCategory,
      sub_category: editSubCategory,
    });

    // Bidirectional: if linking X→Y and Y has no link, set Y→X
    // so the chain is always connected
    if (editingLinkedTo) {
      const targetWord = words.find((w) => w.id === editingLinkedTo);
      if (targetWord && !targetWord.linked_to) {
        // Check if target is already linked by another word
        const alreadyLinkedBy = words.some((w) => w.id !== editingWordId && w.linked_to === editingLinkedTo);
        if (!alreadyLinkedBy) {
          // Target has no connections besides ours — it's the "root"
          // Our word links to it, which is correct (child → parent)
        }
      }
    }

    await loadWords();
    showSuccess('עודכן! ✨');

    // Return to view mode with updated data
    const updatedWord = words.find((w) => w.id === editingWordId);
    if (updatedWord) {
      openEditModal(updatedWord);
    } else {
      closeEditModal();
    }
  } catch (err) {
    console.error('Error updating word:', err);
  }
}

function handleDelete() {
  const word = words.find(w => w.id === editingWordId);
  const deleteModal = $('#deleteConfirmModal');
  const deleteWordEl = $('#deleteConfirmWord');
  const confirmBtn = $('#deleteConfirmBtn');
  const cancelBtn = $('#deleteCancelBtn');

  if (deleteWordEl && word) deleteWordEl.textContent = word.word;
  deleteModal.classList.remove('hidden');

  function cleanup() {
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
    deleteModal.removeEventListener('click', onOverlay);
  }

  async function onConfirm() {
    cleanup();
    deleteModal.classList.add('hidden');
    try {
      await deleteWord(editingWordId);
      closeEditModal();
      await loadWords();
      showSuccess('נמחק 🗑️');
    } catch (err) {
      console.error('Error deleting word:', err);
    }
  }

  function onCancel() {
    cleanup();
    deleteModal.classList.add('hidden');
  }

  function onOverlay(e) {
    if (e.target === deleteModal) onCancel();
  }

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
  deleteModal.addEventListener('click', onOverlay);
}

/* ===== Evolution Chain Modal ===== */
const evoModal = $('#evoModal');
const evoModalClose = $('#evoModalClose');
const evoChain = $('#evoChain');
const evoDoneBtn = $('#evoDoneBtn');
let evoSourceWordId = null;

function openEvoModal(wordId) {
  evoSourceWordId = wordId;
  evoModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderEvoChain();
}

function closeEvoModal() {
  evoModal.classList.add('hidden');
  document.body.style.overflow = '';
  evoSourceWordId = null;
}

function renderEvoChain() {
  evoChain.innerHTML = '';
  const chain = getEvolutionChain(evoSourceWordId);

  if (chain.length <= 1) {
    evoChain.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--soft-purple);font-family:Varela Round,sans-serif;">אין עדיין שרשרת התפתחות.<br>קשרו מילים דרך עריכת מילה.</div>';
    return;
  }

  chain.forEach((w, i) => {
    // Connector before item (except first)
    if (i > 0) {
      const conn = document.createElement('div');
      conn.className = 'evo-connector';
      const line = document.createElement('div');
      line.className = 'evo-connector-line';
      const arrow = document.createElement('div');
      arrow.className = 'evo-connector-arrow';
      arrow.textContent = '▼';
      conn.appendChild(line);
      conn.appendChild(arrow);
      evoChain.appendChild(conn);
    }

    const item = document.createElement('div');
    item.className = 'evo-chain-item' + (w.id === evoSourceWordId ? ' evo-current' : '');

    const num = document.createElement('div');
    num.className = 'evo-chain-number';
    num.textContent = i + 1;

    const info = document.createElement('div');
    info.className = 'evo-chain-info';
    const wordEl = document.createElement('div');
    wordEl.className = 'evo-chain-word';
    wordEl.textContent = w.word;
    const ageEl = document.createElement('div');
    ageEl.className = 'evo-chain-age';
    ageEl.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';
    info.appendChild(wordEl);
    info.appendChild(ageEl);

    // Reorder arrows
    const arrows = document.createElement('div');
    arrows.className = 'evo-chain-arrows';

    const upBtn = document.createElement('button');
    upBtn.className = 'evo-arrow-btn';
    upBtn.textContent = '▲';
    upBtn.disabled = i === 0;
    upBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      swapChainOrder(chain, i, i - 1);
    });

    const downBtn = document.createElement('button');
    downBtn.className = 'evo-arrow-btn';
    downBtn.textContent = '▼';
    downBtn.disabled = i === chain.length - 1;
    downBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      swapChainOrder(chain, i, i + 1);
    });

    arrows.appendChild(upBtn);
    arrows.appendChild(downBtn);

    item.appendChild(num);
    item.appendChild(info);
    item.appendChild(arrows);

    // Click to open edit modal for this word
    info.addEventListener('click', () => {
      closeEvoModal();
      const wordObj = words.find((o) => o.id === w.id);
      if (wordObj) openEditModal(wordObj);
    });

    evoChain.appendChild(item);
  });
}

async function swapChainOrder(chain, fromIdx, toIdx) {
  if (toIdx < 0 || toIdx >= chain.length) return;

  // Rebuild linked_to pointers for the entire chain in new order
  const newChain = [...chain];
  [newChain[fromIdx], newChain[toIdx]] = [newChain[toIdx], newChain[fromIdx]];

  // Update linked_to: each item points to the next one in chain
  // First item: linked_to = null (it's the root)
  // Each subsequent item: linked_to = previous item
  try {
    for (let i = 0; i < newChain.length; i++) {
      const linkedTo = i > 0 ? newChain[i - 1].id : null;
      if (newChain[i].linked_to !== linkedTo) {
        await updateWord(newChain[i].id, { linked_to: linkedTo });
        newChain[i].linked_to = linkedTo;
        // Update in global words array too
        const globalWord = words.find((w) => w.id === newChain[i].id);
        if (globalWord) globalWord.linked_to = linkedTo;
      }
    }
    renderEvoChain();
    renderWords();
    showSuccess('סדר עודכן! ✨');
  } catch (err) {
    console.error('Error reordering chain:', err);
  }
}

/* ===== Word Evolution Chain ===== */
function getEvolutionChain(wordId) {
  // Find the root (earliest version) by following linked_to backwards
  const byId = new Map(words.map((w) => [w.id, w]));
  const linksTo = new Map(); // child -> parent (linked_to)
  const linksFrom = new Map(); // parent -> child

  words.forEach((w) => {
    if (w.linked_to) {
      linksTo.set(w.id, w.linked_to);
      linksFrom.set(w.linked_to, w.id);
    }
  });

  // Find root: go backwards via linked_to
  let root = wordId;
  const visited = new Set();
  while (linksTo.has(root) && !visited.has(root)) {
    visited.add(root);
    root = linksTo.get(root);
  }

  // Build chain forward from root
  const chain = [];
  let current = root;
  visited.clear();
  while (current && !visited.has(current)) {
    visited.add(current);
    const w = byId.get(current);
    if (w) chain.push(w);
    current = linksFrom.get(current);
  }

  return chain.sort((a, b) => (a.age_months ?? 0) - (b.age_months ?? 0));
}

/* ===== View Toggle ===== */
function switchView(view) {
  currentView = view;
  gridViewBtn.classList.toggle('active', view === 'grid');
  timelineViewBtn.classList.toggle('active', view === 'timeline');

  if (view === 'grid') {
    wordsGrid.classList.remove('hidden');
    timelineWrapper.classList.add('hidden');
  } else {
    wordsGrid.classList.add('hidden');
    timelineWrapper.classList.remove('hidden');
    renderTimeline();
  }
}

/* ===== Timeline ===== */
function ageMonthsToDate(months) {
  const date = new Date(BABY_BIRTHDAY);
  date.setMonth(date.getMonth() + months);
  return date;
}

function formatTimelineDate(months) {
  const date = ageMonthsToDate(months);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}.${yyyy}`;
}

// Timeline pagination state
let timelineDisplayCount = 10;
const TIMELINE_PAGE_SIZE = 50;

// Scroll to a timeline item, accounting for sticky nav height
function scrollToTimelineItem(el) {
  const nav = document.getElementById('sectionNav');
  const navH = nav ? nav.offsetHeight : 0;
  const ageOverlay = document.getElementById('timelineAgeOverlay');
  const ageH = ageOverlay ? ageOverlay.offsetHeight : 0;
  const offset = navH + ageH + 12;
  const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
  window.scrollTo({ top: top, behavior: 'smooth' });
}

function renderTimeline() {
  timelineTrack.innerHTML = '';

  // Sort by age descending (newest first, going backwards)
  const filtered = getFilteredWords();
  const sorted = [...filtered].sort((a, b) => (b.age_months ?? 0) - (a.age_months ?? 0));

  // Pagination: only show timelineDisplayCount items
  const totalCount = sorted.length;
  const displaySorted = sorted.slice(0, timelineDisplayCount);

  // Show/hide load more button
  const loadMoreWrap = document.getElementById('timelineLoadMoreWrap');
  if (loadMoreWrap) {
    if (totalCount > timelineDisplayCount) {
      loadMoreWrap.classList.remove('hidden');
      const loadMoreBtn = document.getElementById('timelineLoadMoreBtn');
      const remaining = totalCount - timelineDisplayCount;
      const nextLoad = Math.min(remaining, TIMELINE_PAGE_SIZE);
      loadMoreBtn.textContent = `טענו עוד ${nextLoad} מילים`;
    } else {
      loadMoreWrap.classList.add('hidden');
    }
  }

  if (sorted.length === 0) {
    if (searchQuery) {
      timelineTrack.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--soft-purple);font-family:Varela Round,sans-serif;">לא נמצאו תוצאות 🤷</div>';
    }
    return;
  }

  // Build a set of word IDs that are part of any evolution chain
  const linkedWordIds = new Set();
  // Map from word ID to its direct linked neighbors (for scroll-to)
  const wordNeighbors = new Map();
  sorted.forEach((w) => {
    const hasLink = w.linked_to || words.some((o) => o.linked_to === w.id);
    if (hasLink) {
      const chain = getEvolutionChain(w.id);
      if (chain.length > 1) {
        chain.forEach((c) => linkedWordIds.add(c.id));
        // Find this word's position in the chain and store neighbors
        const idx = chain.findIndex((c) => c.id === w.id);
        const neighbors = [];
        if (idx > 0) neighbors.push(chain[idx - 1].id);
        if (idx < chain.length - 1) neighbors.push(chain[idx + 1].id);
        wordNeighbors.set(w.id, neighbors);
      }
    }
  });

  // Map word IDs to their timeline DOM elements for scroll-to
  const wordItemMap = new Map();

  displaySorted.forEach((w, i) => {
    const isLinked = linkedWordIds.has(w.id);

    const item = document.createElement('div');
    item.className = 'timeline-item reveal-on-scroll' + (isLinked ? ' timeline-item-linked' : '');
    item.style.setProperty('--reveal-delay', `${Math.min(i * 0.08, 0.5)}s`);
    item.dataset.ageMonths = w.age_months ?? 0;
    item.dataset.wordId = w.id;

    wordItemMap.set(w.id, item);

    const cat = getWordCategory(w);
    const catColor = cat && CDI_CAT_COLORS[cat] ? CDI_CAT_COLORS[cat] : null;

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    if (catColor) {
      dot.style.background = catColor;
    }

    const card = document.createElement('div');
    card.className = 'timeline-card';
    if (catColor) {
      card.style.setProperty('--card-accent', catColor);
      card.classList.add('timeline-card-categorized');
    }
    card.addEventListener('click', () => openEditModal(w));

    const wordEl = document.createElement('div');
    wordEl.className = 'timeline-card-word';
    wordEl.textContent = w.word;

    const ageEl = document.createElement('div');
    ageEl.className = 'timeline-card-age';
    ageEl.textContent = w.age_months !== null ? ageMonthsToHebrew(w.age_months) : '';

    card.appendChild(wordEl);
    card.appendChild(ageEl);

    if (w.notes) {
      const notesEl = document.createElement('div');
      notesEl.className = 'timeline-card-notes';
      notesEl.textContent = w.notes;
      card.appendChild(notesEl);
    }

    // Show link indicator with scroll-to-neighbor on tap
    if (isLinked) {
      const tlChain = getEvolutionChain(w.id);
      if (tlChain.length > 1) {
        const linkEl = document.createElement('div');
        linkEl.className = 'timeline-card-link';
        linkEl.textContent = tlChain.map((c) => c.word).join(' ← ');
        linkEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openEvoModal(w.id);
        });
        card.appendChild(linkEl);
      }
    }

    item.appendChild(dot);
    item.appendChild(card);
    timelineTrack.appendChild(item);

    // Dashed connector to next word if they are linked
    const nextIdx = i + 1;
    if (nextIdx < displaySorted.length) {
      const nextWord = displaySorted[nextIdx];
      if (w.linked_to === nextWord.id || nextWord.linked_to === w.id) {
        const evo = document.createElement('div');
        evo.className = 'timeline-evolution';
        const evoLine = document.createElement('div');
        evoLine.className = 'timeline-evo-line';
        const evoArrow = document.createElement('div');
        evoArrow.className = 'timeline-evo-arrow';
        evoArrow.textContent = '▼';
        evo.appendChild(evoLine);
        evo.appendChild(evoArrow);
        timelineTrack.appendChild(evo);
      }
    }
  });

  // Initial overlay update
  updateTimelineOverlay();

  // Observe timeline items for scroll-reveal
  requestAnimationFrame(() => observeRevealElements());
}

function onTimelineScroll() {
  if (currentView !== 'timeline') return;
  updateTimelineOverlay();
}

function updateTimelineOverlay() {
  const items = timelineTrack.querySelectorAll('.timeline-item');
  if (items.length === 0) {
    timelineAgeText.textContent = '';
    return;
  }

  const scrollContainer = document.querySelector('#timelineScroll');
  const containerRect = scrollContainer.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;
  let closest = items[0];
  let closestDist = Infinity;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    const dist = Math.abs(itemCenter - centerY);
    if (dist < closestDist) {
      closestDist = dist;
      closest = item;
    }
  });

  const months = parseInt(closest.dataset.ageMonths) || 0;
  const hebrewAge = ageMonthsToHebrew(months);
  const dateStr = formatTimelineDate(months);
  timelineAgeText.textContent = `${hebrewAge} - ${dateStr}`;
}

/* ===== Trends Chart ===== */
function renderTrends() {
  const trendsSection = document.getElementById('trendsSection');
  const svg = document.getElementById('trendsSvg');
  const tooltip = document.getElementById('trendsTooltip');
  const statCard = document.getElementById('trendsStatCard');
  const statText = document.getElementById('trendsStatText');

  if (!svg || !trendsSection) return;

  // Only show trends if we have words
  if (words.length === 0) {
    trendsSection.style.display = 'none';
    return;
  }
  trendsSection.style.display = '';

  // Count unique words (not linked_to variants) per month
  const uniqueWords = words.filter(w => !w.linked_to);
  if (uniqueWords.length === 0) {
    trendsSection.style.display = 'none';
    return;
  }

  // Group unique words by age_months
  const wordsPerMonth = {};
  uniqueWords.forEach(w => {
    const m = w.age_months ?? 0;
    wordsPerMonth[m] = (wordsPerMonth[m] || 0) + 1;
  });

  // Determine range: from min month to current baby age
  const allMonths = Object.keys(wordsPerMonth).map(Number);
  const minMonth = Math.min(...allMonths);
  const now = new Date();
  const currentAgeMonths = Math.max(
    (now.getFullYear() - BABY_BIRTHDAY.getFullYear()) * 12 +
    (now.getMonth() - BABY_BIRTHDAY.getMonth()),
    Math.max(...allMonths)
  );

  // Build cumulative data points
  const dataPoints = [];
  let cumulative = 0;
  for (let m = minMonth; m <= currentAgeMonths; m++) {
    const newThisMonth = wordsPerMonth[m] || 0;
    cumulative += newThisMonth;
    dataPoints.push({ month: m, total: cumulative, newWords: newThisMonth });
  }

  if (dataPoints.length < 1) {
    trendsSection.style.display = 'none';
    return;
  }

  // Find best month (most new words)
  let bestMonth = dataPoints[0];
  dataPoints.forEach(dp => {
    if (dp.newWords > bestMonth.newWords) bestMonth = dp;
  });

  // --- SVG Chart Drawing ---
  const svgRect = svg.getBoundingClientRect();
  const W = svgRect.width || 600;
  const H = svgRect.height || 260;
  const pad = { top: 25, right: 16, bottom: 44, left: 42 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const maxTotal = Math.max(...dataPoints.map(d => d.total), 1);
  // Nice Y-axis ticks
  const yStep = maxTotal <= 5 ? 1 : maxTotal <= 15 ? 2 : maxTotal <= 30 ? 5 : 10;
  const yMax = Math.ceil(maxTotal / yStep) * yStep;

  const xScale = (m) => pad.left + ((m - minMonth) / Math.max(currentAgeMonths - minMonth, 1)) * chartW;
  const yScale = (v) => pad.top + chartH - (v / yMax) * chartH;

  // Clear previous
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';

  // Defs for gradient
  const defs = document.createElementNS(ns, 'defs');
  const grad = document.createElementNS(ns, 'linearGradient');
  grad.id = 'trendsFill';
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(ns, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', '#6C5CE7');
  stop1.setAttribute('stop-opacity', '0.25');
  const stop2 = document.createElementNS(ns, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', '#6C5CE7');
  stop2.setAttribute('stop-opacity', '0.02');
  grad.appendChild(stop1);
  grad.appendChild(stop2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Y-axis grid lines & labels
  for (let v = 0; v <= yMax; v += yStep) {
    const y = yScale(v);
    // Grid line
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', pad.left);
    line.setAttribute('x2', W - pad.right);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', v === 0 ? 'rgba(108,92,231,0.15)' : 'rgba(108,92,231,0.06)');
    line.setAttribute('stroke-width', v === 0 ? '1.5' : '1');
    svg.appendChild(line);
    // Label
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', pad.left - 6);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('class', 'axis-label');
    label.textContent = v;
    svg.appendChild(label);
  }

  // X-axis labels (show select months to avoid overlap)
  const totalMonths = currentAgeMonths - minMonth + 1;
  const xLabelInterval = totalMonths <= 8 ? 1 : totalMonths <= 16 ? 2 : 3;
  for (let m = minMonth; m <= currentAgeMonths; m += xLabelInterval) {
    const x = xScale(m);
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', H - pad.bottom + 18);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'axis-label');
    label.textContent = ageMonthsToHebrew(m);
    // Truncate long labels for small screens
    const shortLabel = m === 0 ? 'לידה' : m < 12 ? m + ' ח\'' : (Math.floor(m/12)) + ' ש\'' + (m%12 > 0 ? ' ' + (m%12) + 'ח\'' : '');
    label.textContent = shortLabel;
    svg.appendChild(label);

    // Small tick
    const tick = document.createElementNS(ns, 'line');
    tick.setAttribute('x1', x);
    tick.setAttribute('x2', x);
    tick.setAttribute('y1', yScale(0));
    tick.setAttribute('y2', yScale(0) + 5);
    tick.setAttribute('stroke', 'rgba(108,92,231,0.15)');
    tick.setAttribute('stroke-width', '1');
    svg.appendChild(tick);
  }

  // Build line path and area path
  let linePath = '';
  let areaPath = '';
  dataPoints.forEach((dp, i) => {
    const x = xScale(dp.month);
    const y = yScale(dp.total);
    if (i === 0) {
      linePath = `M${x},${y}`;
      areaPath = `M${x},${yScale(0)} L${x},${y}`;
    } else {
      linePath += ` L${x},${y}`;
      areaPath += ` L${x},${y}`;
    }
  });
  // Close area
  const lastX = xScale(dataPoints[dataPoints.length - 1].month);
  const firstX = xScale(dataPoints[0].month);
  areaPath += ` L${lastX},${yScale(0)} L${firstX},${yScale(0)} Z`;

  // Area fill
  const areaEl = document.createElementNS(ns, 'path');
  areaEl.setAttribute('d', areaPath);
  areaEl.setAttribute('fill', 'url(#trendsFill)');
  areaEl.style.opacity = '0';
  areaEl.style.transition = 'opacity 0.8s ease';
  svg.appendChild(areaEl);
  requestAnimationFrame(() => { areaEl.style.opacity = '1'; });

  // Line stroke (dashed between points)
  const lineEl = document.createElementNS(ns, 'path');
  lineEl.setAttribute('d', linePath);
  lineEl.setAttribute('fill', 'none');
  lineEl.setAttribute('stroke', '#6C5CE7');
  lineEl.setAttribute('stroke-width', '2.5');
  lineEl.setAttribute('stroke-linecap', 'round');
  lineEl.setAttribute('stroke-linejoin', 'round');
  lineEl.setAttribute('stroke-dasharray', '8 5');
  svg.appendChild(lineEl);

  // Vertical cursor line (hidden by default)
  const cursorLine = document.createElementNS(ns, 'line');
  cursorLine.setAttribute('x1', 0);
  cursorLine.setAttribute('x2', 0);
  cursorLine.setAttribute('y1', pad.top);
  cursorLine.setAttribute('y2', pad.top + chartH);
  cursorLine.setAttribute('stroke', 'rgba(108,92,231,0.35)');
  cursorLine.setAttribute('stroke-width', '1.5');
  cursorLine.setAttribute('stroke-dasharray', '4 3');
  cursorLine.style.display = 'none';
  svg.appendChild(cursorLine);

  // Data points (circles) - interactive
  const circles = [];
  dataPoints.forEach((dp) => {
    const cx = xScale(dp.month);
    const cy = yScale(dp.total);
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', dp.month === bestMonth.month ? '6' : '4');
    circle.setAttribute('fill', dp.month === bestMonth.month ? '#FF6B9D' : '#6C5CE7');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.style.cursor = 'pointer';
    circle.style.transition = 'r 0.15s ease';
    svg.appendChild(circle);
    circles.push({ dp, cx, cy, circle });
  });

  // Red dot for selected point
  const redDotGroup = document.createElementNS(ns, 'g');
  redDotGroup.setAttribute('id', 'growthRedDot');
  svg.appendChild(redDotGroup);

  function drawRedDot() {
    const redDot = document.getElementById('growthRedDot');
    redDot.innerHTML = '';
    if (selectedGrowthMonth === null) return;

    const selected = circles.find(c => c.dp.month === selectedGrowthMonth);
    if (!selected) return;

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', selected.cx);
    dot.setAttribute('cy', selected.cy);
    dot.setAttribute('r', '8');
    dot.setAttribute('fill', '#FF1744');
    dot.setAttribute('opacity', '0.9');
    redDot.appendChild(dot);
  }

  // Interactive hit area over entire chart for cursor + tooltip
  const hitRect = document.createElementNS(ns, 'rect');
  hitRect.setAttribute('x', pad.left);
  hitRect.setAttribute('y', pad.top);
  hitRect.setAttribute('width', chartW);
  hitRect.setAttribute('height', chartH);
  hitRect.setAttribute('fill', 'transparent');
  hitRect.style.cursor = 'crosshair';
  svg.appendChild(hitRect);

  function findClosest(mx) {
    let closest = null, minDist = Infinity;
    circles.forEach(c => {
      const d = Math.abs(mx - c.cx);
      if (d < minDist) { minDist = d; closest = c; }
    });
    return closest;
  }

  function showCursor(mx) {
    const c = findClosest(mx);
    if (!c) return;
    // Vertical cursor line
    cursorLine.setAttribute('x1', c.cx);
    cursorLine.setAttribute('x2', c.cx);
    cursorLine.style.display = '';

    // Highlight closest point
    circles.forEach(o => {
      o.circle.setAttribute('r', o.dp.month === bestMonth.month ? '6' : '4');
    });
    c.circle.setAttribute('r', c.dp.month === bestMonth.month ? '8' : '6');

    // Tooltip
    const hebrewAge = ageMonthsToHebrew(c.dp.month);
    const dateStr = formatTimelineDate(c.dp.month);
    tooltip.innerHTML = `<strong>${hebrewAge}</strong> (${dateStr})<br>סה״כ: ${c.dp.total} מילים` +
      (c.dp.newWords > 0 ? `<br>חדשות: +${c.dp.newWords}` : '');
    tooltip.classList.remove('hidden');

    const containerRect = svg.parentElement.getBoundingClientRect();
    let tipX = c.cx - (tooltip.offsetWidth / 2);
    let tipY = c.cy - tooltip.offsetHeight - 14;
    const maxTipX = containerRect.width - tooltip.offsetWidth - 8;
    tipX = Math.max(8, Math.min(tipX, maxTipX));
    if (tipY < 0) tipY = c.cy + 20;
    tooltip.style.left = tipX + 'px';
    tooltip.style.top = tipY + 'px';
  }

  function hideCursor() {
    cursorLine.style.display = 'none';
    tooltip.classList.add('hidden');
    circles.forEach(o => {
      o.circle.setAttribute('r', o.dp.month === bestMonth.month ? '6' : '4');
    });
  }

  hitRect.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    showCursor(e.clientX - rect.left);
  });
  hitRect.addEventListener('mouseleave', hideCursor);
  hitRect.addEventListener('click', (e) => {
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const c = findClosest(mx);
    if (c) {
      selectedGrowthMonth = c.dp.month;
      drawRedDot();
    }
  });
  hitRect.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    showCursor(e.touches[0].clientX - rect.left);
    setTimeout(hideCursor, 2500);
  }, { passive: false });
  hitRect.addEventListener('touchend', (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const mx = touch.clientX - rect.left;
    const c = findClosest(mx);
    if (c) {
      selectedGrowthMonth = c.dp.month;
      drawRedDot();
    }
  }, { passive: false });

  // Draw red dot if a month is selected
  drawRedDot();

  // --- Delta Chart (new words per month) ---
  const deltaSvg = document.getElementById('deltaSvg');
  const deltaTooltip = document.getElementById('deltaTooltip');
  if (deltaSvg && dataPoints.length > 0) {
    const dRect = deltaSvg.getBoundingClientRect();
    const dW = dRect.width || 600;
    const dH = dRect.height || 260;
    const dPad = { top: 25, right: 16, bottom: 44, left: 42 };
    const dChartW = dW - dPad.left - dPad.right;
    const dChartH = dH - dPad.top - dPad.bottom;

    const maxNew = Math.max(...dataPoints.map(d => d.newWords), 1);
    const dYStep = maxNew <= 5 ? 1 : maxNew <= 15 ? 2 : maxNew <= 30 ? 5 : 10;
    const dYMax = Math.ceil(maxNew / dYStep) * dYStep;

    const dXScale = (m) => dPad.left + ((m - minMonth) / Math.max(currentAgeMonths - minMonth, 1)) * dChartW;
    const dYScale = (v) => dPad.top + dChartH - (v / dYMax) * dChartH;

    deltaSvg.innerHTML = '';

    // Y-axis grid
    for (let v = 0; v <= dYMax; v += dYStep) {
      const y = dYScale(v);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', dPad.left);
      line.setAttribute('x2', dW - dPad.right);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', v === 0 ? 'rgba(255,107,157,0.15)' : 'rgba(255,107,157,0.06)');
      line.setAttribute('stroke-width', v === 0 ? '1.5' : '1');
      deltaSvg.appendChild(line);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', dPad.left - 6);
      label.setAttribute('y', y + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('class', 'axis-label');
      label.textContent = v;
      deltaSvg.appendChild(label);
    }

    // X-axis labels
    for (let m = minMonth; m <= currentAgeMonths; m += xLabelInterval) {
      const x = dXScale(m);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', dH - dPad.bottom + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'axis-label');
      const shortLabel = m === 0 ? 'לידה' : m < 12 ? m + ' ח\'' : (Math.floor(m/12)) + ' ש\'' + (m%12 > 0 ? ' ' + (m%12) + 'ח\'' : '');
      label.textContent = shortLabel;
      deltaSvg.appendChild(label);
    }

    // Bars
    const barW = Math.max(8, Math.min(28, (dChartW / dataPoints.length) - 4));
    const deltaBars = [];
    dataPoints.forEach((dp) => {
      const cx = dXScale(dp.month);
      const barH = dp.newWords > 0 ? (dp.newWords / dYMax) * dChartH : 0;
      const y = dYScale(dp.newWords);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', cx - barW / 2);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barH);
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', dp.month === bestMonth.month ? '#FF6B9D' : 'rgba(108,92,231,0.6)');
      deltaSvg.appendChild(rect);
      deltaBars.push({ dp, cx, rect });
    });

    // Delta cursor line
    const dCursorLine = document.createElementNS(ns, 'line');
    dCursorLine.setAttribute('y1', dPad.top);
    dCursorLine.setAttribute('y2', dPad.top + dChartH);
    dCursorLine.setAttribute('stroke', 'rgba(255,107,157,0.35)');
    dCursorLine.setAttribute('stroke-width', '1.5');
    dCursorLine.setAttribute('stroke-dasharray', '4 3');
    dCursorLine.style.display = 'none';
    deltaSvg.appendChild(dCursorLine);

    // Delta hit area
    const dHitRect = document.createElementNS(ns, 'rect');
    dHitRect.setAttribute('x', dPad.left);
    dHitRect.setAttribute('y', dPad.top);
    dHitRect.setAttribute('width', dChartW);
    dHitRect.setAttribute('height', dChartH);
    dHitRect.setAttribute('fill', 'transparent');
    dHitRect.style.cursor = 'crosshair';
    deltaSvg.appendChild(dHitRect);

    function dFindClosest(mx) {
      let closest = null, minDist = Infinity;
      deltaBars.forEach(b => {
        const d = Math.abs(mx - b.cx);
        if (d < minDist) { minDist = d; closest = b; }
      });
      return closest;
    }

    dHitRect.addEventListener('mousemove', (e) => {
      const rect = deltaSvg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const c = dFindClosest(mx);
      if (!c) return;
      dCursorLine.setAttribute('x1', c.cx);
      dCursorLine.setAttribute('x2', c.cx);
      dCursorLine.style.display = '';
      deltaBars.forEach(b => b.rect.setAttribute('opacity', '0.5'));
      c.rect.setAttribute('opacity', '1');

      const hebrewAge = ageMonthsToHebrew(c.dp.month);
      deltaTooltip.innerHTML = `<strong>${hebrewAge}</strong><br>+${c.dp.newWords} מילים חדשות`;
      deltaTooltip.classList.remove('hidden');
      const containerRect = deltaSvg.parentElement.getBoundingClientRect();
      let tipX = c.cx - (deltaTooltip.offsetWidth / 2);
      let tipY = dYScale(c.dp.newWords) - deltaTooltip.offsetHeight - 10;
      tipX = Math.max(8, Math.min(tipX, containerRect.width - deltaTooltip.offsetWidth - 8));
      if (tipY < 0) tipY = dYScale(c.dp.newWords) + 20;
      deltaTooltip.style.left = tipX + 'px';
      deltaTooltip.style.top = tipY + 'px';
    });
    dHitRect.addEventListener('mouseleave', () => {
      dCursorLine.style.display = 'none';
      deltaTooltip.classList.add('hidden');
      deltaBars.forEach(b => b.rect.setAttribute('opacity', '1'));
    });
    dHitRect.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = deltaSvg.getBoundingClientRect();
      const mx = e.touches[0].clientX - rect.left;
      const c = dFindClosest(mx);
      if (!c) return;
      dCursorLine.setAttribute('x1', c.cx);
      dCursorLine.setAttribute('x2', c.cx);
      dCursorLine.style.display = '';
      const hebrewAge = ageMonthsToHebrew(c.dp.month);
      deltaTooltip.innerHTML = `<strong>${hebrewAge}</strong><br>+${c.dp.newWords} מילים חדשות`;
      deltaTooltip.classList.remove('hidden');
      const containerRect = deltaSvg.parentElement.getBoundingClientRect();
      let tipX = c.cx - (deltaTooltip.offsetWidth / 2);
      deltaTooltip.style.left = Math.max(8, Math.min(tipX, containerRect.width - deltaTooltip.offsetWidth - 8)) + 'px';
      deltaTooltip.style.top = (dYScale(c.dp.newWords) - deltaTooltip.offsetHeight - 10) + 'px';
      setTimeout(() => {
        dCursorLine.style.display = 'none';
        deltaTooltip.classList.add('hidden');
      }, 2500);
    }, { passive: false });
  }

  // --- Stat Card ---
  if (bestMonth.newWords > 0) {
    statCard.style.display = '';
    const monthDate = ageMonthsToDate(bestMonth.month);
    const hebrewMonthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const monthName = hebrewMonthNames[monthDate.getMonth()];
    const yearShort = String(monthDate.getFullYear()).slice(2);

    statText.innerHTML =
      `<i data-lucide="trending-up" class="stat-icon"></i> ` +
      `בחודש <span class="stat-highlight">${monthName} ${yearShort}'</span> ` +
      `${BABY_NAME} למדה לא פחות מ-` +
      `<span class="stat-highlight">${bestMonth.newWords} מילים חדשות</span>`;
    if (window.lucide) lucide.createIcons();

    // Observe for reveal animation
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          statCard.classList.add('revealed');
          observer.unobserve(statCard);
        }
      });
    }, { threshold: 0.3 });
    statCard.classList.remove('revealed');
    observer.observe(statCard);
  } else {
    statCard.style.display = 'none';
  }
}

// Re-render trends on window resize (debounced)
let trendsResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(trendsResizeTimer);
  trendsResizeTimer = setTimeout(() => {
    renderTrends();
    renderAcquisitionCharts();
  }, 250);
});

/* ===== Trends Tabs ===== */
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.trends-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.trends-tab-content').forEach(c => c.classList.remove('active'));
      const target = document.getElementById(targetId);
      if (target) {
        target.classList.add('active');
        if (targetId === 'acquisitionView') {
          // Delay rendering to ensure container is visible (display:block applied)
          requestAnimationFrame(() => renderAcquisitionCharts());
        }
        if (targetId === 'growthView') {
          // Re-render growth charts in case they need to resize
          requestAnimationFrame(() => renderTrends());
        }
      }
    });
  });

  // Window size buttons for pulse chart
  const windowBtns = document.querySelectorAll('.acq-window-btn');
  windowBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      windowBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      acqWindowSize = parseInt(btn.dataset.size);
      renderAcquisitionCharts();
    });
  });
});

/* ===== Acquisition Charts Rendering ===== */
let acqWindowSize = 10;

function renderAcquisitionCharts() {
  if (typeof AcquisitionAnalysis === 'undefined') return;
  if (!words.length) return;

  const ordered = AcquisitionAnalysis.getAcquisitionOrder(words);
  if (ordered.length < 3) return;

  const AA = AcquisitionAnalysis;

  // Build legend helper
  function buildAcqLegend(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    AA.CAT_ORDER.forEach(c => {
      const span = document.createElement('span');
      span.className = 'acq-legend-item';
      span.innerHTML = '<span class="acq-legend-dot" style="background:' + AA.CAT_COLORS[c] + '"></span>' + AA.CAT_LABELS[c];
      el.appendChild(span);
    });
  }

  // ---- CHAPTER 1: Noun Bias Trend ----
  drawAcqNounBias(ordered, AA);

  // ---- CHAPTER 2: Rolling Category Mix ----
  drawAcqPulse(ordered, AA);
  buildAcqLegend('acqPulseLeg');

  // ---- CHAPTER 3: Milestone Comparison ----
  drawAcqMilestones(ordered, AA);
  buildAcqLegend('acqMilestonesLeg');

  // ---- STAT CARD ----
  renderAcqStatCard(ordered, AA);

  // ---- CHAPTER 4: Category Streaks ----
  renderStreakCards(ordered, AA);
  renderLastStreakCard(ordered, AA);

  // ---- CHAPTER 5: Insights ----
  renderInsights(ordered, AA);

  // Observe for scroll reveal
  requestAnimationFrame(() => observeRevealElements());
}

/* ===== Chapter 1: Noun Bias Trend ===== */
function drawAcqNounBias(ordered, AA) {
  const canvas = document.getElementById('acqNounBiasCanvas');
  const titleEl = document.getElementById('acqNounBiasTitle');
  const descEl = document.getElementById('acqNounBiasDesc');
  if (!canvas) return;

  const nounData = AA.getNounBiasData(ordered);
  if (titleEl) titleEl.textContent = AA.getNounBiasTitle(nounData);

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.offsetWidth;
  const H = 260;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 16, right: 16, bottom: 36, left: 42 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const n = nounData.length;
  if (n < 2) return;

  function xPos(i) { return PAD.left + (i / Math.max(n - 1, 1)) * cW; }
  function yPos(v) { return PAD.top + cH - (v / 100) * cH; }

  ctx.clearRect(0, 0, W, H);

  // Grid lines at 25% intervals
  ctx.strokeStyle = 'rgba(108,92,231,0.08)';
  ctx.lineWidth = 1;
  for (let v = 0; v <= 100; v += 25) {
    ctx.beginPath();
    ctx.moveTo(PAD.left, yPos(v));
    ctx.lineTo(W - PAD.right, yPos(v));
    ctx.stroke();
    ctx.fillStyle = 'rgba(108,92,231,0.5)';
    ctx.font = '10px Varela Round, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v + '%', PAD.left - 6, yPos(v) + 4);
  }

  // 50% reference line (dashed, prominent)
  ctx.save();
  ctx.strokeStyle = 'rgba(255,107,157,0.3)';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, yPos(50));
  ctx.lineTo(W - PAD.right, yPos(50));
  ctx.stroke();
  ctx.restore();

  // X-axis labels (milestone word numbers)
  const milestones = AA.getDynamicMilestones(n);
  ctx.fillStyle = 'rgba(108,92,231,0.6)';
  ctx.font = '10px Varela Round, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1', xPos(0), H - PAD.bottom + 16);
  milestones.forEach(m => {
    ctx.fillText(m, xPos(m - 1), H - PAD.bottom + 16);
  });

  // Gradient fill under the line
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
  grad.addColorStop(0, 'rgba(108,92,231,0.2)');
  grad.addColorStop(1, 'rgba(108,92,231,0.02)');

  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(nounData[0].nounPct));
  for (let i = 1; i < n; i++) {
    const cpx = (xPos(i - 1) + xPos(i)) / 2;
    ctx.bezierCurveTo(cpx, yPos(nounData[i - 1].nounPct), cpx, yPos(nounData[i].nounPct), xPos(i), yPos(nounData[i].nounPct));
  }
  // Close area
  ctx.lineTo(xPos(n - 1), yPos(0));
  ctx.lineTo(xPos(0), yPos(0));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // The line itself
  ctx.beginPath();
  ctx.moveTo(xPos(0), yPos(nounData[0].nounPct));
  for (let i = 1; i < n; i++) {
    const cpx = (xPos(i - 1) + xPos(i)) / 2;
    ctx.bezierCurveTo(cpx, yPos(nounData[i - 1].nounPct), cpx, yPos(nounData[i].nounPct), xPos(i), yPos(nounData[i].nounPct));
  }
  ctx.strokeStyle = '#6C5CE7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Start and end dots
  const startPct = nounData[0].nounPct;
  const endPct = nounData[n - 1].nounPct;
  [[0, startPct], [n - 1, endPct]].forEach(([idx, pct]) => {
    ctx.beginPath();
    ctx.arc(xPos(idx), yPos(pct), 5, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? '#FF6B9D' : '#6C5CE7';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Labels for start and end
  ctx.font = 'bold 11px Secular One, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FF6B9D';
  ctx.fillText(startPct + '%', xPos(0) + 8, yPos(startPct) - 6);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6C5CE7';
  ctx.fillText(endPct + '%', xPos(n - 1) - 8, yPos(endPct) - 6);

  // "שמות עצם" label on the left side
  ctx.font = '10px Varela Round, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(108,92,231,0.4)';
  ctx.fillText('מילה #', PAD.left + cW / 2, H - PAD.bottom + 28);

  // Function to draw red dot for selected point
  function drawNounBiasRedDot() {
    if (selectedNounBiasIndex === null || selectedNounBiasIndex >= n) return;

    // Clear canvas and redraw everything
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(108,92,231,0.08)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= 100; v += 25) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, yPos(v));
      ctx.lineTo(W - PAD.right, yPos(v));
      ctx.stroke();
      ctx.fillStyle = 'rgba(108,92,231,0.5)';
      ctx.font = '10px Varela Round, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v + '%', PAD.left - 6, yPos(v) + 4);
    }

    // 50% line
    ctx.save();
    ctx.strokeStyle = 'rgba(255,107,157,0.3)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, yPos(50));
    ctx.lineTo(W - PAD.right, yPos(50));
    ctx.stroke();
    ctx.restore();

    // X-axis labels
    const milestones = AA.getDynamicMilestones(n);
    ctx.fillStyle = 'rgba(108,92,231,0.6)';
    ctx.font = '10px Varela Round, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1', xPos(0), H - PAD.bottom + 16);
    milestones.forEach(m => {
      ctx.fillText(m, xPos(m - 1), H - PAD.bottom + 16);
    });

    // Gradient fill
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(nounData[0].nounPct));
    for (let i = 1; i < n; i++) {
      const cpx = (xPos(i - 1) + xPos(i)) / 2;
      ctx.bezierCurveTo(cpx, yPos(nounData[i - 1].nounPct), cpx, yPos(nounData[i].nounPct), xPos(i), yPos(nounData[i].nounPct));
    }
    ctx.lineTo(xPos(n - 1), yPos(0));
    ctx.lineTo(xPos(0), yPos(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // The line
    ctx.beginPath();
    ctx.moveTo(xPos(0), yPos(nounData[0].nounPct));
    for (let i = 1; i < n; i++) {
      const cpx = (xPos(i - 1) + xPos(i)) / 2;
      ctx.bezierCurveTo(cpx, yPos(nounData[i - 1].nounPct), cpx, yPos(nounData[i].nounPct), xPos(i), yPos(nounData[i].nounPct));
    }
    ctx.strokeStyle = '#6C5CE7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Start and end dots
    [[0, startPct], [n - 1, endPct]].forEach(([idx, pct]) => {
      ctx.beginPath();
      ctx.arc(xPos(idx), yPos(pct), 5, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? '#FF6B9D' : '#6C5CE7';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Labels
    ctx.font = 'bold 11px Secular One, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF6B9D';
    ctx.fillText(startPct + '%', xPos(0) + 8, yPos(startPct) - 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6C5CE7';
    ctx.fillText(endPct + '%', xPos(n - 1) - 8, yPos(endPct) - 6);

    // "מילה #" label
    ctx.font = '10px Varela Round, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(108,92,231,0.4)';
    ctx.fillText('מילה #', PAD.left + cW / 2, H - PAD.bottom + 28);

    // Draw red dot at selected point
    const selectedPt = nounData[selectedNounBiasIndex];
    ctx.beginPath();
    ctx.arc(xPos(selectedNounBiasIndex), yPos(selectedPt.nounPct), 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FF1744';
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Tooltip on click
  const tipEl = document.getElementById('acqNounBiasTip');
  canvas.onclick = function (e) {
    if (!tipEl) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let closest = 0, minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(mx - xPos(i));
      if (d < minDist) { minDist = d; closest = i; }
    }
    selectedNounBiasIndex = closest;
    const pt = nounData[closest];
    const w = ordered[closest];
    let html = '<div class="acq-tip-card"><strong>מילה #' + pt.index + ': ' + pt.word + '</strong>';
    if (w.category) html += ' <span style="color:' + AA.CAT_COLORS[w.category] + '">(' + AA.CAT_LABELS[w.category] + ')</span>';
    html += '<br>שמות עצם: <strong>' + pt.nounPct + '%</strong> מאוצר המילים';
    html += '<br>שאר קטגוריות: <strong>' + (100 - pt.nounPct) + '%</strong>';
    html += '</div>';
    tipEl.innerHTML = html;
    drawNounBiasRedDot();
  };

  // Draw red dot if a point is selected
  drawNounBiasRedDot();
}

/* ===== Chapter 2: Rolling Category Mix ===== */
function drawAcqPulse(ordered, AA) {
  const canvas = document.getElementById('acqPulseCanvas');
  const titleEl = document.getElementById('acqPulseTitle');
  if (!canvas) return;

  const windows = AA.getAllWindows(ordered, acqWindowSize);
  if (titleEl) titleEl.textContent = AA.getPulseTitle(windows);

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.offsetWidth;
  const rowH = 36;
  const gap = 8;
  const H = Math.max(200, windows.length * (rowH + gap) + 60);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 8, right: 12, bottom: 8, left: 70 };
  const barMaxW = W - PAD.left - PAD.right;

  ctx.clearRect(0, 0, W, H);

  windows.forEach((win, wi) => {
    const y = PAD.top + wi * (rowH + gap);

    // Label
    ctx.fillStyle = 'rgba(45,27,105,0.7)';
    ctx.font = '12px Varela Round, sans-serif';
    ctx.textAlign = 'right';
    let label = win.label;
    if (win.wordCount < acqWindowSize) label += ' (' + win.wordCount + ')';
    ctx.fillText(label, PAD.left - 8, y + rowH / 2 + 4);

    // Stacked bar
    let xOffset = PAD.left;
    AA.CAT_ORDER.forEach(c => {
      const count = win.counts[c] || 0;
      if (count === 0) return;
      const segW = win.total > 0 ? (count / win.total) * barMaxW : 0;
      if (segW < 1) return;

      ctx.fillStyle = AA.CAT_COLORS[c];
      ctx.globalAlpha = 0.85;

      // Rounded corners on first/last segments
      const isFirst = xOffset === PAD.left;
      const isLast = (xOffset + segW) >= (PAD.left + barMaxW - 1);
      const r = 6;
      ctx.beginPath();
      if (isFirst && isLast) {
        ctx.moveTo(xOffset + r, y);
        ctx.arcTo(xOffset + segW, y, xOffset + segW, y + rowH, r);
        ctx.arcTo(xOffset + segW, y + rowH, xOffset, y + rowH, r);
        ctx.arcTo(xOffset, y + rowH, xOffset, y, r);
        ctx.arcTo(xOffset, y, xOffset + segW, y, r);
      } else if (isFirst) {
        ctx.moveTo(xOffset + r, y);
        ctx.lineTo(xOffset + segW, y);
        ctx.lineTo(xOffset + segW, y + rowH);
        ctx.arcTo(xOffset, y + rowH, xOffset, y, r);
        ctx.arcTo(xOffset, y, xOffset + segW, y, r);
      } else if (isLast) {
        ctx.moveTo(xOffset, y);
        ctx.arcTo(xOffset + segW, y, xOffset + segW, y + rowH, r);
        ctx.arcTo(xOffset + segW, y + rowH, xOffset, y + rowH, r);
        ctx.lineTo(xOffset, y + rowH);
        ctx.lineTo(xOffset, y);
      } else {
        ctx.rect(xOffset, y, segW, rowH);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Percentage text if segment is wide enough
      const pct = win.total > 0 ? Math.round((count / win.total) * 100) : 0;
      if (segW > 32) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Secular One, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', xOffset + segW / 2, y + rowH / 2);
      }

      xOffset += segW;
    });
  });

  // Tooltip on click
  const tipEl = document.getElementById('acqPulseTip');
  canvas.onclick = function (e) {
    if (!tipEl) return;
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const wi = Math.floor((my - PAD.top) / (rowH + gap));
    if (wi < 0 || wi >= windows.length) return;
    const win = windows[wi];
    let html = '<div class="acq-tip-card"><strong>מילים ' + win.label + '</strong> (' + win.wordCount + ' מילים)<br>';
    AA.CAT_ORDER.forEach(c => {
      const count = win.counts[c] || 0;
      if (count === 0) return;
      const pct = win.total > 0 ? Math.round((count / win.total) * 100) : 0;
      const examples = win.words.filter(w => w.category === c).map(w => w.word).join(', ');
      html += '<span class="acq-legend-dot" style="background:' + AA.CAT_COLORS[c] + '"></span> ' +
        AA.CAT_LABELS[c] + ': ' + count + ' (' + pct + '%) <span style="opacity:0.6">(' + examples + ')</span><br>';
    });
    html += '</div>';
    tipEl.innerHTML = html;
  };
}

/* ===== Chapter 3: Milestone Comparison ===== */
function drawAcqMilestones(ordered, AA) {
  const canvas = document.getElementById('acqMilestonesCanvas');
  const titleEl = document.getElementById('acqMilestonesTitle');
  if (!canvas) return;

  const milestoneData = AA.getMilestoneData(ordered);
  if (titleEl) titleEl.textContent = AA.getMilestoneTitle(milestoneData);

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.offsetWidth;
  const rowH = 42;
  const gap = 12;
  const H = Math.max(200, milestoneData.length * (rowH + gap) + 40);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const PAD = { top: 12, right: 12, bottom: 8, left: 75 };
  const barMaxW = W - PAD.left - PAD.right;

  ctx.clearRect(0, 0, W, H);

  // 50% reference line
  const fiftyX = PAD.left + barMaxW * 0.5;
  ctx.strokeStyle = 'rgba(108,92,231,0.12)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(fiftyX, 0);
  ctx.lineTo(fiftyX, H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(108,92,231,0.3)';
  ctx.font = '9px Varela Round, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('50%', fiftyX, H - 2);

  milestoneData.forEach((ms, mi) => {
    const y = PAD.top + mi * (rowH + gap);

    // Milestone label
    ctx.fillStyle = 'rgba(45,27,105,0.8)';
    ctx.font = 'bold 13px Secular One, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('מילה ' + ms._milestone, PAD.left - 8, y + rowH / 2);

    // Stacked bar (proportional)
    let xOffset = PAD.left;
    const activeCats = AA.CAT_ORDER.filter(c => ms[c].count > 0);

    activeCats.forEach((c, ci) => {
      const pct = ms[c].pct;
      const segW = ms._total > 0 ? (ms[c].count / ms._total) * barMaxW : 0;
      if (segW < 1) return;

      ctx.fillStyle = AA.CAT_COLORS[c];
      ctx.globalAlpha = 0.85;

      const isFirst = ci === 0;
      const isLast = ci === activeCats.length - 1;
      const r = 8;
      ctx.beginPath();
      if (isFirst && isLast) {
        ctx.moveTo(xOffset + r, y); ctx.arcTo(xOffset + segW, y, xOffset + segW, y + rowH, r);
        ctx.arcTo(xOffset + segW, y + rowH, xOffset, y + rowH, r); ctx.arcTo(xOffset, y + rowH, xOffset, y, r);
        ctx.arcTo(xOffset, y, xOffset + segW, y, r);
      } else if (isFirst) {
        ctx.moveTo(xOffset + r, y); ctx.lineTo(xOffset + segW, y); ctx.lineTo(xOffset + segW, y + rowH);
        ctx.arcTo(xOffset, y + rowH, xOffset, y, r); ctx.arcTo(xOffset, y, xOffset + segW, y, r);
      } else if (isLast) {
        ctx.moveTo(xOffset, y); ctx.arcTo(xOffset + segW, y, xOffset + segW, y + rowH, r);
        ctx.arcTo(xOffset + segW, y + rowH, xOffset, y + rowH, r); ctx.lineTo(xOffset, y + rowH); ctx.lineTo(xOffset, y);
      } else {
        ctx.rect(xOffset, y, segW, rowH);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Percentage inside if wide enough
      if (segW > 35 && pct >= 10) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Secular One, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pct + '%', xOffset + segW / 2, y + rowH / 2);
      }

      xOffset += segW;
    });
  });

  // Tooltip on click
  const tipEl = document.getElementById('acqMilestonesTip');
  canvas.onclick = function (e) {
    if (!tipEl) return;
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const mi = Math.floor((my - PAD.top) / (rowH + gap));
    if (mi < 0 || mi >= milestoneData.length) return;
    const ms = milestoneData[mi];
    let html = '<div class="acq-tip-card"><strong>מילה ' + ms._milestone + '</strong> — ' + ms._total + ' מילים מסווגות<br>';
    AA.CAT_ORDER.forEach(c => {
      if (ms[c].count === 0) return;
      const examples = (ms._examples[c] || []).join(', ');
      html += '<span class="acq-legend-dot" style="background:' + AA.CAT_COLORS[c] + '"></span> ' +
        AA.CAT_LABELS[c] + ': ' + ms[c].count + ' (' + ms[c].pct + '%)';
      if (examples) html += ' <span style="opacity:0.6">(' + examples + ')</span>';
      html += '<br>';
    });
    html += '</div>';
    tipEl.innerHTML = html;
  };
}

/* ===== Acquisition Stat Card ===== */
function renderAcqStatCard(ordered, AA) {
  const statCard = document.getElementById('acqStatCard');
  const statText = document.getElementById('acqStatText');
  if (!statCard || !statText || ordered.length < 5) {
    if (statCard) statCard.style.display = 'none';
    return;
  }

  const babyName = BABY_NAME;

  // Find the most diverse window of 10 words
  const windows = AA.getAllWindows(ordered, 10);
  let mostDiverse = windows[0];
  windows.forEach(w => {
    if (w.uniqueCategories > mostDiverse.uniqueCategories) mostDiverse = w;
  });

  // Get noun bias data
  const nounData = AA.getNounBiasData(ordered);
  const currentNounPct = nounData.length > 0 ? nounData[nounData.length - 1].nounPct : 0;

  // Get category emergence
  const emergence = AA.getCategoryEmergence(ordered);
  const activeCatCount = AA.CAT_ORDER.filter(c => emergence[c].count > 0).length;

  // Build stat text — pick the most interesting stat
  let html = '<i data-lucide="sparkles" class="stat-icon"></i> ';

  if (mostDiverse.uniqueCategories >= 4) {
    html += `במילים <span class="stat-highlight">${mostDiverse.label}</span> ` +
      `${babyName} הפגינה את הגיוון הגדול ביותר — ` +
      `<span class="stat-highlight">${mostDiverse.uniqueCategories} קטגוריות שונות</span> ` +
      `בקבוצה אחת`;
  } else if (nounData.length >= 15) {
    const earlyPct = nounData[Math.min(14, nounData.length - 1)].nounPct;
    if (earlyPct - currentNounPct > 10) {
      html += `שמות עצם ירדו מ-<span class="stat-highlight">${earlyPct}%</span> ` +
        `ב-15 המילים הראשונות ל-<span class="stat-highlight">${currentNounPct}%</span> היום — ` +
        `סימן לגיוון בריא`;
    } else {
      html += `${babyName} רכשה מילים מ-<span class="stat-highlight">${activeCatCount} קטגוריות שונות</span> ` +
        `ושמות עצם מהווים <span class="stat-highlight">${currentNounPct}%</span> מאוצר המילים`;
    }
  } else {
    html += `${babyName} כבר רכשה <span class="stat-highlight">${ordered.length} מילים</span> ` +
      `מ-<span class="stat-highlight">${activeCatCount} קטגוריות</span>`;
  }

  statText.innerHTML = html;
  statCard.style.display = '';
  if (window.lucide) lucide.createIcons();

  // Observe for reveal animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        statCard.classList.add('revealed');
        observer.unobserve(statCard);
      }
    });
  }, { threshold: 0.3 });
  statCard.classList.remove('revealed');
  observer.observe(statCard);
}

/* ===== Chapter 4: Category Streaks ===== */
function renderStreakCards(ordered, AA) {
  const container = document.getElementById('acqStreaksList');
  const card = document.getElementById('acqStreaks');
  if (!container) return;
  container.innerHTML = '';

  const streaks = AA.getCategoryStreaks(ordered);

  // Collect categories with longest streak > 3
  const qualifying = [];
  AA.CAT_ORDER.forEach(c => {
    const s = streaks[c];
    if (s.longest && s.longest.length > 3) {
      qualifying.push({ cat: c, streak: s.longest, label: s.label, color: s.color });
    }
  });

  if (qualifying.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';

  // Sort by streak length descending
  qualifying.sort((a, b) => b.streak.length - a.streak.length);

  qualifying.forEach(q => {
    const el = document.createElement('div');
    el.className = 'streak-item';

    const fromIdx = q.streak[0].index;
    const toIdx = q.streak[q.streak.length - 1].index;

    // Stat sentence with highlights
    el.innerHTML =
      '<div class="trends-stat-card acq-streak-stat revealed">' +
        '<p class="trends-stat-text">' +
          '<i data-lucide="zap" class="stat-icon"></i> ' +
          'רצף של <span class="stat-highlight">' + q.streak.length + ' ' + q.label + '</span> ' +
          'במילים <span class="stat-highlight">#' + fromIdx + '-#' + toIdx + '</span>' +
        '</p>' +
      '</div>';

    // Compact word list
    const wordList = document.createElement('div');
    wordList.className = 'streak-words';
    const INITIAL_SHOW = 10;
    const wordsToShow = q.streak.slice(0, INITIAL_SHOW);
    const hasMore = q.streak.length > INITIAL_SHOW;

    wordsToShow.forEach(w => {
      const tag = document.createElement('span');
      tag.className = 'streak-word-tag';
      tag.style.borderColor = q.color;
      tag.textContent = w.word;
      wordList.appendChild(tag);
    });

    if (hasMore) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'streak-load-more';
      moreBtn.textContent = 'עוד ' + (q.streak.length - INITIAL_SHOW) + ' מילים';
      moreBtn.addEventListener('click', () => {
        q.streak.slice(INITIAL_SHOW).forEach(w => {
          const tag = document.createElement('span');
          tag.className = 'streak-word-tag';
          tag.style.borderColor = q.color;
          tag.textContent = w.word;
          wordList.insertBefore(tag, moreBtn);
        });
        moreBtn.remove();
      });
      wordList.appendChild(moreBtn);
    }

    el.appendChild(wordList);
    container.appendChild(el);
  });

  if (window.lucide) lucide.createIcons();
}

function renderLastStreakCard(ordered, AA) {
  const card = document.getElementById('acqLastStreakCard');
  const text = document.getElementById('acqLastStreakText');
  if (!card || !text) return;

  const last = AA.getLastStreak(ordered);
  if (!last || last.words.length < 2) {
    card.style.display = 'none';
    return;
  }

  const babyName = BABY_NAME;
  const wordsPreview = last.words.slice(-4).map(w => w.word).join(', ');

  text.innerHTML =
    '<i data-lucide="flame" class="stat-icon"></i> ' +
    'הרצף האחרון של ' + babyName + ': ' +
    '<span class="stat-highlight">' + last.words.length + ' ' + last.label + '</span> ' +
    'ברצף — ' +
    '<span class="stat-highlight">' + wordsPreview + '</span>';

  card.style.display = '';
  if (window.lucide) lucide.createIcons();

  // Observe for reveal animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        card.classList.add('revealed');
        observer.unobserve(card);
      }
    });
  }, { threshold: 0.3 });
  card.classList.remove('revealed');
  observer.observe(card);
}

/* ===== Chapter 5: Insights ===== */
function renderInsights(ordered, AA) {
  const container = document.getElementById('acqInsightsList');
  if (!container) return;

  const insights = AA.generateInsights(ordered);
  container.innerHTML = '';

  if (insights.length === 0) {
    container.innerHTML = '<div class="acq-insight-empty">צריך עוד מילים כדי לגלות תובנות מעניינות</div>';
    return;
  }

  insights.forEach((insight, i) => {
    const card = document.createElement('div');
    card.className = 'acq-insight-card reveal-on-scroll';
    card.style.setProperty('--reveal-delay', (i * 0.15) + 's');
    card.innerHTML = '<div class="acq-insight-text">' + insight.text + '</div>';
    container.appendChild(card);
  });
}

/* ===== Export ===== */
document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (words.length === 0) {
        showSuccess('אין מילים לייצוא');
        return;
      }
      const data = JSON.stringify(words, null, 2);
      navigator.clipboard.writeText(data).then(() => {
        showSuccess('הועתק! 📋 (' + words.length + ' מילים)');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = data;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showSuccess('הועתק! 📋 (' + words.length + ' מילים)');
      });
    });
  }

  // --- Section Navigation ---
  const navWords = document.getElementById('navWords');
  const navTrends = document.getElementById('navTrends');
  const navAddWord = document.getElementById('navAddWord');
  const wordsSection = document.getElementById('wordsSection');
  const trendsSection = document.getElementById('trendsSection');
  const inputSection = document.getElementById('inputSection');

  function setActiveNav(activeBtn) {
    document.querySelectorAll('.section-nav-btn:not(.section-nav-add)').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  if (navWords) {
    navWords.addEventListener('click', () => {
      setActiveNav(navWords);
      wordsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (navTrends) {
    navTrends.addEventListener('click', () => {
      setActiveNav(navTrends);
      trendsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (navAddWord) {
    navAddWord.addEventListener('click', () => {
      inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const wordInput = document.getElementById('wordInput');
        if (wordInput) wordInput.focus();
      }, 400);
    });
  }

  // Update active nav on scroll
  const navObserverOptions = { rootMargin: '-40% 0px -50% 0px' };
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target.id === 'wordsSection') setActiveNav(navWords);
        else if (entry.target.id === 'trendsSection') setActiveNav(navTrends);
      }
    });
  }, navObserverOptions);
  if (wordsSection) navObserver.observe(wordsSection);
  if (trendsSection) navObserver.observe(trendsSection);

  // --- Timeline Load More ---
  const loadMoreBtn = document.getElementById('timelineLoadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      const filtered = getFilteredWords();
      const total = filtered.length;
      if (timelineDisplayCount + TIMELINE_PAGE_SIZE >= total) {
        timelineDisplayCount = total;
      } else {
        timelineDisplayCount += TIMELINE_PAGE_SIZE;
      }
      renderTimeline();
    });
  }
});

/* ===== PWA: Service Worker, Install Prompt, Realtime, Push ===== */

let deferredInstallPrompt = null;
let realtimeChannel = null;

function initPWA() {
  registerServiceWorker();
  setupInstallPrompt();
  initRealtime();
  initPushNotifications();
  checkForUpdates();
}

/* --- Service Worker Registration --- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      console.log('[PWA] Service worker registered, scope:', reg.scope);

      // Listen for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available - activate immediately
            newWorker.postMessage('SKIP_WAITING');
            showRealtimeToast('גרסה חדשה זמינה! רענון...', () => {
              window.location.reload();
            });
          }
        });
      });
    })
    .catch((err) => {
      console.warn('[PWA] SW registration failed:', err);
    });

  // Handle messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'WORD_ADDED_NOTIFICATION') {
      loadWords();
    }
  });
}

/* --- Install Prompt --- */
function setupInstallPrompt() {
  const banner = document.getElementById('pwaInstallBanner');
  const installBtn = document.getElementById('pwaInstallBtn');
  const dismissBtn = document.getElementById('pwaInstallDismiss');

  if (!banner || !installBtn || !dismissBtn) return;

  // Check if already dismissed recently (24h)
  const dismissed = localStorage.getItem('pwa_install_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) return;

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    // Show install banner after a short delay
    setTimeout(() => {
      banner.classList.remove('hidden');
    }, 3000);
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    deferredInstallPrompt = null;
    banner.classList.add('hidden');
  });

  dismissBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
  });

  // Handle successful install
  window.addEventListener('appinstalled', () => {
    banner.classList.add('hidden');
    deferredInstallPrompt = null;
    showSuccess('האפליקציה הותקנה! 📲');
  });
}

/* --- Supabase Realtime --- */
function initRealtime() {
  if (!db) return;

  realtimeChannel = db
    .channel('words-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'words' },
      (payload) => {
        console.log('[Realtime] Change:', payload.eventType);

        if (payload.eventType === 'INSERT') {
          const newWord = payload.new;
          // Check if this word was added by this device (avoid double notification)
          const recentlyAdded = words.some(
            (w) => w.word === newWord.word && w.id === newWord.id
          );
          if (!recentlyAdded) {
            showRealtimeToast(`מילה חדשה נוספה: "${newWord.word}" 🌟`);
          }
        }

        // Reload words to sync
        loadWords();
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Subscription status:', status);
    });
}

/* --- Push Notifications --- */
async function initPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  // Only ask for permission after user installs or interacts
  if (Notification.permission === 'default') {
    // Wait for install or first word add - we'll request permission then
    // This avoids the annoying immediate permission popup
    return;
  }

  if (Notification.permission === 'granted') {
    await subscribeToPush();
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    await subscribeToPush();
    return true;
  }
  return false;
}

async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      console.log('[Push] Already subscribed');
      await savePushSubscription(existing);
      return;
    }

    // VAPID public key - generate your own pair and replace this
    // Use: npx web-push generate-vapid-keys
    const vapidPublicKey = localStorage.getItem('vapid_public_key');
    if (!vapidPublicKey) {
      console.log('[Push] No VAPID key configured. Push notifications disabled.');
      return;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await savePushSubscription(subscription);
    console.log('[Push] Subscribed successfully');
  } catch (err) {
    console.warn('[Push] Subscription failed:', err);
  }
}

async function savePushSubscription(subscription) {
  if (!db) return;
  try {
    const subJson = subscription.toJSON();
    const deviceId = localStorage.getItem('device_id') || crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);

    await db.from('push_subscriptions').upsert(
      {
        device_id: deviceId,
        endpoint: subJson.endpoint,
        keys_p256dh: subJson.keys?.p256dh || '',
        keys_auth: subJson.keys?.auth || '',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'device_id' }
    );
  } catch (err) {
    console.warn('[Push] Failed to save subscription:', err);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* --- Realtime Toast UI --- */
function showRealtimeToast(text, onClick) {
  const toast = document.getElementById('realtimeToast');
  const toastText = document.getElementById('realtimeToastText');
  const closeBtn = document.getElementById('realtimeToastClose');
  if (!toast || !toastText) return;

  toastText.textContent = text;
  toast.classList.remove('hidden');

  if (onClick) {
    toast.style.cursor = 'pointer';
    toast.onclick = (e) => {
      if (e.target !== closeBtn) {
        onClick();
        toast.classList.add('hidden');
      }
    };
  }

  clearTimeout(showRealtimeToast._timer);
  showRealtimeToast._timer = setTimeout(() => {
    toast.classList.add('hidden');
    toast.onclick = null;
  }, 5000);

  closeBtn.onclick = () => {
    toast.classList.add('hidden');
    toast.onclick = null;
    clearTimeout(showRealtimeToast._timer);
  };
}

/* --- Version Check & Update Modal --- */
async function checkForUpdates() {
  try {
    const resp = await fetch('./version.json?_=' + Date.now());
    if (!resp.ok) return;
    const remote = await resp.json();
    const localVersion = localStorage.getItem('app_version');

    // First install — save version, no popup
    if (!localVersion) {
      localStorage.setItem('app_version', remote.version);
      return;
    }

    // Same version — nothing to do
    if (localVersion === remote.version) return;

    // New version available — show update modal
    showUpdateModal(remote);
  } catch (e) {
    // Network error — skip silently
  }
}

function showUpdateModal(remote) {
  const modal = document.getElementById('updateModal');
  const message = document.getElementById('updateModalMessage');
  const version = document.getElementById('updateModalVersion');
  const updateBtn = document.getElementById('updateModalBtn');
  const dismissBtn = document.getElementById('updateModalDismiss');
  if (!modal) return;

  message.textContent = remote.message || 'עדכון חדש זמין לאפליקציה';
  version.textContent = 'גרסה ' + remote.version;

  if (remote.mandatory) {
    // Mandatory: no dismiss, can't close
    dismissBtn.classList.add('hidden');
    modal.onclick = null; // prevent closing by clicking overlay
  } else {
    // Optional: can dismiss, but comes back next open
    dismissBtn.classList.remove('hidden');
    dismissBtn.onclick = () => {
      modal.classList.add('hidden');
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    };
  }

  updateBtn.onclick = () => {
    // Save new version so modal won't show again
    localStorage.setItem('app_version', remote.version);
    // Clear service worker cache to force fresh load
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
    }
    // Navigate to install page
    window.location.href = 'install.html';
  };

  modal.classList.remove('hidden');
}

/* --- Request notification permission after first word add --- */
const _originalSaveNewWord = saveNewWord;
saveNewWord = async function(notes) {
  await _originalSaveNewWord(notes);
  // After first word save, request notification permission
  if (Notification.permission === 'default') {
    // Small delay so it doesn't feel jarring
    setTimeout(() => requestNotificationPermission(), 2000);
  }
};
