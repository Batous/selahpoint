(function () {
  'use strict';

  const JSON_PATH = '/data/bibles/kjv.json';
  const state = {
    step: 'BOOK',
    bookId: '',
    bookName: '',
    chapter: null,
    rangeStart: null,
    verseCount: 0
  };

  function bridge() {
    return window.SELAH_KB || {};
  }

  function books() {
    const api = bridge();
    if (Array.isArray(api.books)) return api.books;
    if (Array.isArray(window.BOOKS)) return window.BOOKS;
    return [];
  }

  function bookNames() {
    return bridge().bookNames || window.BOOK_NAMES || {};
  }

  function setLegacySelection(bookId, chapter, verse) {
    const api = bridge();
    if (typeof api.setSelection === 'function') {
      api.setSelection({ bookId, chapter, verse });
    } else {
      window._kbBook = bookId || '';
      window._kbCh = chapter || null;
      window._kbVs = verse || null;
    }
  }

  async function getBibleData() {
    if (window.bibleData) return window.bibleData;
    if (window.bibleCache && window.bibleCache[JSON_PATH]) return window.bibleCache[JSON_PATH];
    if (typeof getOfflineBibleData === 'function') return getOfflineBibleData(JSON_PATH);
    const res = await fetch(JSON_PATH);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    window.bibleCache = window.bibleCache || {};
    window.bibleCache[JSON_PATH] = data;
    window.bibleData = data;
    return data;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function findBookData(bible, bookName) {
    const want = normalize(bookName);
    if (Array.isArray(bible)) {
      return bible.find(book => normalize(book.name) === want || normalize(book.slug) === want) || null;
    }
    const key = Object.keys(bible || {}).find(name => normalize(name) === want);
    return key ? bible[key] : null;
  }

  function getChapterList(bookData) {
    if (!bookData) return [];
    if (Array.isArray(bookData.chapters)) return bookData.chapters;
    if (Array.isArray(bookData)) return bookData;
    if (typeof bookData === 'object') {
      return Object.keys(bookData)
        .filter(key => /^\d+$/.test(key))
        .sort((a, b) => Number(a) - Number(b))
        .map(key => bookData[key]);
    }
    return [];
  }

  function getVerseList(chapterData) {
    if (!chapterData) return [];
    if (Array.isArray(chapterData.verses)) return chapterData.verses;
    if (Array.isArray(chapterData)) return chapterData;
    if (typeof chapterData === 'object') {
      return Object.keys(chapterData)
        .filter(key => /^\d+$/.test(key))
        .sort((a, b) => Number(a) - Number(b))
        .map(key => chapterData[key]);
    }
    return [];
  }

  function ensureBibleCaps(bible) {
    window.BIBLE_CAPS = window.BIBLE_CAPS || {};
    if (Array.isArray(bible)) {
      bible.forEach(book => {
        if (book && book.name) window.BIBLE_CAPS[book.name] = { ch: getChapterList(book).length || 1 };
      });
    } else if (bible && typeof bible === 'object') {
      Object.keys(bible).forEach(name => {
        window.BIBLE_CAPS[name] = { ch: getChapterList(bible[name]).length || 1 };
      });
    }
  }

  function clearGrid() {
    const grid = document.getElementById('kb-grid');
    if (grid) grid.innerHTML = '';
    const preview = document.getElementById('num-preview');
    if (preview) preview.style.display = 'none';
    const pad = document.getElementById('num-pad');
    if (pad) {
      pad.style.display = 'none';
      pad.innerHTML = '';
    }
    hideModeBar();
  }

  function setCrumbs(text) {
    const crumbs = document.getElementById('kb-crumbs');
    if (crumbs) crumbs.textContent = text;
  }

  function hideModeBar() {
    const bar = document.getElementById('mode-bar');
    if (!bar) return;
    bar.style.display = 'none';
    bar.innerHTML = '';
  }

  function showModeBar(items) {
    const bar = document.getElementById('mode-bar');
    if (!bar) return;
    bar.innerHTML = '';
    bar.style.display = 'flex';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.type = 'button';
      btn.textContent = item.label;
      btn.onclick = item.handler;
      bar.appendChild(btn);
    });
  }

  function gridButton(label, handler, extraClass) {
    const grid = document.getElementById('kb-grid');
    if (!grid) return null;
    const btn = document.createElement('button');
    btn.className = 'kb-btn' + (extraClass ? ' ' + extraClass : '');
    btn.type = 'button';
    btn.textContent = label;
    btn.onclick = handler;
    grid.appendChild(btn);
    return btn;
  }

  function resetState() {
    state.step = 'BOOK';
    state.bookId = '';
    state.bookName = '';
    state.chapter = null;
    state.rangeStart = null;
    state.verseCount = 0;
    setLegacySelection('', null, null);
  }

  function openKb() {
    if (typeof setSidebarOpen === 'function') setSidebarOpen(false);
    else document.getElementById('sidebar')?.classList.remove('open');
    resetState();
    document.getElementById('kb-modal')?.classList.add('open');
    renderBooks();
  }

  function closeKb() {
    document.getElementById('kb-modal')?.classList.remove('open');
  }

  function handleKbOutside(event) {
    if (event && event.target && event.target.id === 'kb-modal') closeKb();
  }

  function renderBooks() {
    state.step = 'BOOK';
    clearGrid();
    setCrumbs('Select a book');
    books().forEach(book => {
      const name = bookNames()[book.id] || book.id;
      const btn = gridButton(book.n, () => selectBook(book.id));
      if (btn) btn.title = name;
    });
  }

  async function selectBook(bookId) {
    const names = bookNames();
    state.bookId = bookId;
    state.bookName = names[bookId] || bookId;
    state.chapter = null;
    state.rangeStart = null;
    setLegacySelection(bookId, null, null);
    await renderChapters();
  }

  async function renderChapters() {
    state.step = 'CHAPTER';
    clearGrid();
    setCrumbs(state.bookName + ' > Select chapter');
    let count = 1;
    try {
      const bible = await getBibleData();
      ensureBibleCaps(bible);
      count = getChapterList(findBookData(bible, state.bookName)).length || 1;
    } catch (error) {
      console.warn('[kb-navigator] chapter count fallback:', error);
      count = (window.BIBLE_CAPS && window.BIBLE_CAPS[state.bookName]?.ch) || 50;
    }
    for (let i = 1; i <= count; i++) gridButton(String(i), () => selectChapter(i));
    showModeBar([
      { label: 'Back to books', handler: renderBooks },
      { label: 'Whole book', handler: () => displayMode('book') }
    ]);
  }

  async function selectChapter(chapter) {
    state.chapter = chapter;
    state.rangeStart = null;
    setLegacySelection(state.bookId, chapter, null);
    await renderVerses();
  }

  async function renderVerses() {
    state.step = 'VERSE';
    clearGrid();
    setCrumbs(state.bookName + ' ' + state.chapter + ' > Select verse');
    let count = 50;
    try {
      const bible = await getBibleData();
      ensureBibleCaps(bible);
      const chapters = getChapterList(findBookData(bible, state.bookName));
      count = getVerseList(chapters[state.chapter - 1]).length || 50;
    } catch (error) {
      console.warn('[kb-navigator] verse count fallback:', error);
    }
    state.verseCount = count;
    for (let i = 1; i <= count; i++) {
      const btn = gridButton(String(i), () => selectVerse(i));
      if (btn) btn.dataset.verse = String(i);
    }
    const info = document.createElement('div');
    info.id = 'kb-verse-info';
    info.style.cssText = 'grid-column:1/-1;color:var(--gold);font-size:.72rem;text-align:center;padding:.35rem .5rem;';
    info.textContent = 'Tap a verse once, then choose This verse only or tap a second verse for a range.';
    document.getElementById('kb-grid')?.appendChild(info);
    showModeBar([
      { label: 'Back to chapters', handler: renderChapters },
      { label: 'Whole chapter', handler: () => displayMode('chapter') },
      { label: 'Whole book', handler: () => displayMode('book') }
    ]);
  }

  function selectVerse(verse) {
    const info = document.getElementById('kb-verse-info');
    if (state.rangeStart === null) {
      state.rangeStart = verse;
      setLegacySelection(state.bookId, state.chapter, verse);
      document.querySelectorAll('#kb-grid .kb-btn.sel').forEach(btn => btn.classList.remove('sel'));
      document.querySelector(`#kb-grid .kb-btn[data-verse="${verse}"]`)?.classList.add('sel');
      if (info) info.textContent = 'Verse ' + verse + ' selected. Tap another verse for a range.';
      if (!document.getElementById('kb-this-verse')) {
        const btn = gridButton('This verse only', () => displayMode('verse'), 'sel');
        if (btn) {
          btn.id = 'kb-this-verse';
          btn.style.gridColumn = '1 / -1';
        }
      }
      return;
    }
    if (verse < state.rangeStart) {
      if (info) info.textContent = 'Choose a second verse after ' + state.rangeStart + ', or use This verse only.';
      return;
    }
    displayRange(state.rangeStart, verse);
  }

  async function displayMode(mode) {
    if (!state.bookId) return;
    if (mode !== 'book' && !state.chapter) return;
    if (mode === 'verse' && !state.rangeStart) return;
    setLegacySelection(state.bookId, state.chapter || 1, mode === 'verse' ? state.rangeStart : null);
    if (mode === 'book') {
      try { ensureBibleCaps(await getBibleData()); } catch (error) { console.warn('[kb-navigator] caps load failed:', error); }
    }
    if (typeof fetchAndDisplay === 'function') fetchAndDisplay(mode);
  }

  async function displayRange(start, end) {
    setLegacySelection(state.bookId, state.chapter, start);
    closeKb();
    const card = document.getElementById('display-card');
    const refEl = document.getElementById('disp-ref');
    const bodyEl = document.getElementById('disp-body');
    if (card) card.classList.add('visible');
    if (refEl) refEl.textContent = 'Loading...';
    if (bodyEl) bodyEl.textContent = '';
    const ref = state.bookName + ' ' + state.chapter + ':' + start + '-' + end;
    try {
      const bible = await getBibleData();
      ensureBibleCaps(bible);
      const verses = typeof extractVerses === 'function'
        ? extractVerses(bible, state.chapter, start, state.chapter, end, state.bookName)
        : [];
      window._currentAudioRange = {
        book: state.bookName,
        bible_version: 'KJV',
        chapter_start: state.chapter,
        verse_start: start,
        chapter_end: state.chapter,
        verse_end: end
      };
      window._currentAudioVerses = verses;
      if (typeof renderDisplayCard === 'function') renderDisplayCard(ref, verses, 'range');
      else {
        if (refEl) refEl.textContent = ref;
        if (bodyEl) bodyEl.textContent = verses.map(v => v.text || v.content || v).join(' ');
      }
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (refEl) refEl.textContent = 'Error';
      if (bodyEl) bodyEl.textContent = 'Could not load scripture from local Bible data. (' + error.message + ')';
    }
  }

  window.openKb = openKb;
  window.closeKb = closeKb;
  window.handleKbOutside = handleKbOutside;
  window.renderBooks = renderBooks;
  window.renderChapters = renderChapters;
  window.renderVerses = renderVerses;
})();