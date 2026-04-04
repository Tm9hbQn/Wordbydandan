/* ===== Configuration ===== */
const SUPABASE_URL = 'https://hxhyaumawnmsbqwediqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aHlhdW1hd25tc2Jxd2VkaXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDI2ODAsImV4cCI6MjA5MDgxODY4MH0.NEXiKaMfI_PS6LxyiYHSzHOqsOBHTuHICLDErVNJckY';

const BABY_BIRTHDAY = new Date(2024, 11, 5); // December 5, 2024
const BABY_NAME = 'דניאלה';

/* ===== Supabase Client ===== */
let supabase = null;
let useLocalStorage = false;

function initSupabase() {
  try {
    if (!window.supabase) {
      console.warn('Supabase SDK not loaded yet, using localStorage');
      useLocalStorage = true;
      return;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useLocalStorage = false;
    console.log('Supabase connected');
  } catch (e) {
    console.error('Supabase init failed:', e);
    useLocalStorage = true;
  }
}

// Called when Supabase SDK finishes loading asynchronously
function initSupabaseAndReload() {
  if (supabase) return; // already initialized
  initSupabase();
  if (!useLocalStorage) {
    loadWords(); // reload from Supabase
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
  if (useLocalStorage) {
    return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  try {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch error:', error.message);
      // Fallback to localStorage if Supabase fails
      return getLocalWords().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
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

  if (useLocalStorage) return localFallback();

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
  if (useLocalStorage) {
    const words = getLocalWords();
    const idx = words.findIndex((w) => w.id === id);
    if (idx >= 0) {
      words[idx] = { ...words[idx], ...updates, updated_at: new Date().toISOString() };
      saveLocalWords(words);
      return words[idx];
    }
    return null;
  }
  const { data, error } = await supabase
    .from('words')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteWord(id) {
  if (useLocalStorage) {
    const words = getLocalWords().filter((w) => w.id !== id);
    saveLocalWords(words);
    return;
  }
  const { error } = await supabase.from('words').delete().eq('id', id);
  if (error) throw error;
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

let currentView = 'timeline';

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

  // Edit modal
  modalClose.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });
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

  // View toggle
  if (gridViewBtn) gridViewBtn.addEventListener('click', () => switchView('grid'));
  if (timelineViewBtn) timelineViewBtn.addEventListener('click', () => switchView('timeline'));

  // Timeline scroll observer
  window.addEventListener('scroll', onTimelineScroll, { passive: true });
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

  if (words.length === 0) {
    emptyState.classList.remove('hidden');
    wordCount.textContent = '0';
    return;
  }

  emptyState.classList.add('hidden');
  animateCount(wordCount, words.length);

  words.forEach((w, i) => {
    const card = document.createElement('div');
    card.className = 'word-card reveal-on-scroll';
    card.style.setProperty('--reveal-delay', `${i * 0.06}s`);
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
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);

function observeRevealElements() {
  document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach((el) => {
    revealObserver.observe(el);
  });
}

/* ===== Edit Modal ===== */
function openEditModal(word) {
  editingWordId = word.id;
  editWordInput.textContent = word.word;
  editNotesInput.textContent = word.notes || '';

  buildAgeOptions(editAgePicker, word.age_months);

  editModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeEditModal() {
  editModal.classList.add('hidden');
  document.body.style.overflow = '';
  editingWordId = null;
}

async function handleEditSave() {
  const word = getInputText(editWordInput).trim();
  if (!word) return;

  const selectedAge = editAgePicker.querySelector('.age-option.selected');
  const ageMonths = selectedAge ? parseInt(selectedAge.dataset.months) : null;
  const notes = getInputText(editNotesInput).trim() || null;

  try {
    await updateWord(editingWordId, { word, age_months: ageMonths, notes });
    closeEditModal();
    await loadWords();
    showSuccess('עודכן! ✨');
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
  const sorted = [...words].sort((a, b) => (b.age_months ?? 0) - (a.age_months ?? 0));

  if (sorted.length === 0) return;

  sorted.forEach((w, i) => {
    const item = document.createElement('div');
    item.className = 'timeline-item reveal-on-scroll';
    item.style.setProperty('--reveal-delay', `${i * 0.08}s`);
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

    item.appendChild(dot);
    item.appendChild(card);
    timelineTrack.appendChild(item);
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

  const viewportCenter = window.innerHeight / 2;
  let closest = items[0];
  let closestDist = Infinity;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const itemCenter = rect.top + rect.height / 2;
    const dist = Math.abs(itemCenter - viewportCenter);
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
