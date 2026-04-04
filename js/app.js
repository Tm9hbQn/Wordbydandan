/* ===== Configuration ===== */
const SUPABASE_URL = 'https://hxhyaumawnmsbqwediqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aHlhdW1hd25tc2Jxd2VkaXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDI2ODAsImV4cCI6MjA5MDgxODY4MH0.NEXiKaMfI_PS6LxyiYHSzHOqsOBHTuHICLDErVNJckY';

const BABY_BIRTHDAY = new Date(2024, 11, 5); // December 5, 2024
const BABY_NAME = 'דניאלה';

/* ===== Supabase Client ===== */
let supabase = null;

function initSupabase() {
  try {
    if (!window.supabase) {
      console.error('Supabase SDK failed to load');
      return;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase connected');
  } catch (e) {
    console.error('Supabase init failed:', e);
    supabase = null;
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
  if (!supabase) {
    return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  try {
    const { data, error } = await supabase
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

  if (!supabase) return localFallback();

  try {
    const { data, error } = await supabase.from('words').insert(word).select().single();
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
  if (!supabase) {
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
    const { data, error } = await supabase
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
  if (!supabase) {
    const words = getLocalWords().filter((w) => w.id !== id);
    saveLocalWords(words);
    return;
  }
  try {
    const { error } = await supabase.from('words').delete().eq('id', id);
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

let currentView = 'timeline';
let searchQuery = '';

/* ===== Initialize ===== */
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  setupEventListeners();
  buildAgeOptions(ageOptions, null);
  await loadWords();
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

  linkSearchInput.addEventListener('blur', () => {
    // Longer delay for mobile to allow tap on results
    setTimeout(() => linkResults.classList.add('hidden'), 400);
  });

  linkRemoveBtn.addEventListener('click', () => {
    editingLinkedTo = null;
    updateLinkUI();
  });

  // Search
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('hidden', !searchQuery);
    renderWords();
    // Keep search + results visible above keyboard on mobile
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
    renderWords();
  });

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

/* ===== Submit Word Flow ===== */
function submitWord() {
  if (submitting) return;
  const text = wordInput.value.trim();
  if (!text) return;
  submitting = true;

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
    notesSection.classList.remove('hidden');
    notesSection.querySelector('.notes-container').classList.add('fade-in');
  }, 400);
}

async function saveNewWord(notes) {
  const container = notesSection.querySelector('.notes-container');
  container.classList.add('fade-out');

  setTimeout(async () => {
    notesSection.classList.add('hidden');
    container.classList.remove('fade-out', 'fade-in');

    try {
      await insertWord({
        word: currentWord,
        age_months: currentAgeMonths,
        notes: notes || null,
      });

      showSuccess(`"${currentWord}" נוספה! 🌟`);
      await loadWords();
    } catch (err) {
      console.error('Error saving word:', err);
      showSuccess('אופס, משהו השתבש 😅');
    } finally {
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

function getFilteredWords() {
  if (!searchQuery) return words;
  return words.filter((w) => fuzzyMatchWord(searchQuery, w));
}

/* ===== Load & Render Words ===== */
async function loadWords() {
  try {
    words = await fetchWords();
    renderWords();
  } catch (err) {
    console.error('Error loading words:', err);
  }
}

function renderWords() {
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
    card.style.setProperty('--reveal-delay', `${Math.min(i * 0.06, 0.5)}s`);
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
        linkEl.textContent = chain.map((c) => c.word).join(' → ');
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
    chain.forEach((w, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'view-evo-arrow';
        arrow.textContent = '→';
        viewEvoChain.appendChild(arrow);
      }
      const item = document.createElement('span');
      item.className = 'view-evo-item' + (w.id === word.id ? ' evo-active' : '');
      item.textContent = w.word;
      item.addEventListener('click', () => {
        const target = words.find((o) => o.id === w.id);
        if (target && target.id !== word.id) {
          closeEditModal();
          openEditModal(target);
        }
      });
      viewEvoChain.appendChild(item);
    });
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

function closeEditModal() {
  editModal.classList.add('hidden');
  document.body.style.overflow = '';
  editingWordId = null;
  editingLinkedTo = null;
  viewingWord = null;
}

async function handleEditSave() {
  const word = getInputText(editWordInput).trim();
  if (!word) return;

  const selectedAge = editAgePicker.querySelector('.age-option.selected');
  const ageMonths = selectedAge ? parseInt(selectedAge.dataset.months) : null;
  const notes = getInputText(editNotesInput).trim() || null;

  try {
    await updateWord(editingWordId, {
      word,
      age_months: ageMonths,
      notes,
      linked_to: editingLinkedTo,
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

async function handleDelete() {
  if (!confirm('למחוק את המילה?')) return;

  try {
    await deleteWord(editingWordId);
    closeEditModal();
    await loadWords();
    showSuccess('נמחק 🗑️');
  } catch (err) {
    console.error('Error deleting word:', err);
  }
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

function renderTimeline() {
  timelineTrack.innerHTML = '';

  // Sort by age descending (newest first, going backwards)
  const filtered = getFilteredWords();
  const sorted = [...filtered].sort((a, b) => (b.age_months ?? 0) - (a.age_months ?? 0));

  if (sorted.length === 0) {
    if (searchQuery) {
      timelineTrack.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--soft-purple);font-family:Varela Round,sans-serif;">לא נמצאו תוצאות 🤷</div>';
    }
    return;
  }

  sorted.forEach((w, i) => {
    const item = document.createElement('div');
    item.className = 'timeline-item reveal-on-scroll';
    item.style.setProperty('--reveal-delay', `${Math.min(i * 0.08, 0.5)}s`);
    item.dataset.ageMonths = w.age_months ?? 0;

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';

    const card = document.createElement('div');
    card.className = 'timeline-card';
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

    // Show link indicator if part of any chain
    const hasTlLink = w.linked_to || words.some((o) => o.linked_to === w.id);
    if (hasTlLink) {
      const tlChain = getEvolutionChain(w.id);
      if (tlChain.length > 1) {
        const linkEl = document.createElement('div');
        linkEl.className = 'timeline-card-link';
        linkEl.textContent = tlChain.map((c) => c.word).join(' → ');
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

    // Check if next word in sorted list is linked to this one (evolution connector)
    const nextIdx = i + 1;
    if (nextIdx < sorted.length) {
      const nextWord = sorted[nextIdx];
      // Show connector if this word links to next, or next links to this
      if (w.linked_to === nextWord.id || nextWord.linked_to === w.id) {
        const evo = document.createElement('div');
        evo.className = 'timeline-evolution';
        const evoLine = document.createElement('div');
        evoLine.className = 'timeline-evo-line';
        evoLine.textContent = '↕';
        evo.appendChild(evoLine);
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
});
