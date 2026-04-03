/* ===== Configuration ===== */
const SUPABASE_URL = 'https://xyzcompanyid.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'your-anon-key-here'; // Replace with your Supabase anon key

const BABY_BIRTHDAY = new Date(2024, 11, 5); // December 5, 2024
const BABY_NAME = 'דניאלה';

/* ===== Supabase Client ===== */
let supabase = null;
let useLocalStorage = false;

function initSupabase() {
  try {
    if (SUPABASE_URL.includes('xyzcompanyid') || SUPABASE_ANON_KEY === 'your-anon-key-here') {
      console.log('Supabase not configured, using localStorage');
      useLocalStorage = true;
      return;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase init failed, using localStorage:', e);
    useLocalStorage = true;
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
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertWord(word) {
  if (useLocalStorage) {
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
  }
  const { data, error } = await supabase.from('words').insert(word).select().single();
  if (error) throw error;
  return data;
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
  wordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (getInputText(wordInput).trim()) submitWord();
    }
  });

  // Prevent pasting rich text
  wordInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  // Add button
  addBtn.addEventListener('click', submitWord);

  // Age picker
  justNowBtn.addEventListener('click', () => selectAge(calculateCurrentAgeMonths()));

  // Notes
  notesSkipBtn.addEventListener('click', () => saveNewWord(''));
  notesSaveBtn.addEventListener('click', () => saveNewWord(getInputText(notesInput).trim()));

  notesInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
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
}

/* ===== Input Handling ===== */
function getInputText(el) {
  return el.textContent || el.innerText || '';
}

function onWordInput() {
  const text = getInputText(wordInput).trim();
  if (text.length > 0) {
    addBtn.classList.add('visible');
  } else {
    addBtn.classList.remove('visible');
  }
}

function onWordFocus() {
  // Subtle haptic-like visual feedback
  const dot = document.querySelector('.marker-dot');
  dot.style.animation = 'none';
  dot.offsetHeight; // force reflow
  dot.style.animation = 'dotPulse 1s ease-in-out infinite';
}

/* ===== Submit Word Flow ===== */
function submitWord() {
  const text = getInputText(wordInput).trim();
  if (!text) return;

  currentWord = text;

  // Swish out input section
  const markerArea = document.querySelector('.marker-area');
  markerArea.classList.add('swish-out');
  addBtn.classList.remove('visible');

  setTimeout(() => {
    inputSection.classList.add('hidden');
    markerArea.classList.remove('swish-out');

    // Show age section
    ageQuestion.textContent = `מתי ${BABY_NAME} אמרה "${currentWord}" לראשונה?`;
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
    notesTitle.textContent = `רוצה להוסיף הקשר ל"${currentWord}"? 📝`;
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
      const newWord = await insertWord({
        word: currentWord,
        age_months: currentAgeMonths,
        notes: notes || null,
      });

      // Show success
      showSuccess(`"${currentWord}" נוספה! 🌟`);

      // Reload words
      await loadWords();
    } catch (err) {
      console.error('Error saving word:', err);
      showSuccess('אופס, משהו השתבש 😅');
    }

    // Reset input
    resetInput();
  }, 300);
}

function resetInput() {
  wordInput.textContent = '';
  currentWord = '';
  currentAgeMonths = null;
  addBtn.classList.remove('visible');
  inputSection.classList.remove('hidden');
}

function showSuccess(text) {
  successText.textContent = text;
  successOverlay.classList.remove('hidden');

  setTimeout(() => {
    successOverlay.classList.add('hidden');
  }, 1500);
}

/* ===== Age Options Builder ===== */
function buildAgeOptions(container, selectedMonths) {
  container.innerHTML = '';
  const maxMonths = calculateCurrentAgeMonths();

  for (let m = 0; m <= maxMonths; m++) {
    const btn = document.createElement('button');
    btn.className = 'age-option' + (m === selectedMonths ? ' selected' : '');
    btn.textContent = ageMonthsToHebrew(m);
    btn.dataset.months = m;
    btn.addEventListener('click', () => {
      if (container === ageOptions) {
        selectAge(m);
      } else {
        // Edit modal picker
        container.querySelectorAll('.age-option').forEach((o) => o.classList.remove('selected'));
        btn.classList.add('selected');
      }
    });
    container.appendChild(btn);
  }
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
  wordCount.textContent = words.length;

  words.forEach((w, i) => {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.style.animationDelay = `${i * 0.05}s`;
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
