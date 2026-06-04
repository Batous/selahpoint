'use strict';

/* ══════════════════════════════════════════════════════
   CORE PIPELINE & PLAYBACK LOGIC
══════════════════════════════════════════════════════ */
function extractVerses(bookData, chapterStart, verseStart, chapterEnd, verseEnd, bookName) {
  chapterStart = parseInt(chapterStart, 10);
  verseStart   = parseInt(verseStart,   10);
  chapterEnd   = parseInt(chapterEnd,   10);
  verseEnd     = parseInt(verseEnd,     10);

  if (!bookData) { addLog('Bible data is null', 'warn'); return []; }

  const lookupKey = normalizeStr(bookName);
  const out = [];

  if (bookData.verses && Array.isArray(bookData.verses)) {
    for (const v of bookData.verses) {
      if (!v?.book_name) continue;
      if (!bookMatchesValue(lookupKey, v.book_name)) continue;
      const ch = parseInt(v.chapter, 10);
      const vs = parseInt(v.verse,   10);
      if (isNaN(ch) || isNaN(vs)) continue;
      if (ch < chapterStart || ch > chapterEnd) continue;
      if (ch === chapterStart && vs < verseStart) continue;
      if (ch === chapterEnd   && vs > verseEnd)   continue;
      out.push({ chapter: ch, verse: vs, text: String(v.text || '') });
    }
  } else if (Array.isArray(bookData)) {
    const book = bookData.find(b =>
      normalizeStr(b.name || b.slug) === lookupKey || bookMatchesValue(lookupKey, b.name)
    );
    if (book && book.chapters) {
      for (const chObj of book.chapters) {
        const chNum = parseInt(chObj.chapter, 10);
        if (isNaN(chNum) || chNum < chapterStart || chNum > chapterEnd) continue;
        for (const v of chObj.verses || []) {
          const vNum = parseInt(v.verse, 10);
          if (isNaN(vNum)) continue;
          if (chNum === chapterStart && vNum < verseStart) continue;
          if (chNum === chapterEnd   && vNum > verseEnd)   continue;
          out.push({ chapter: chNum, verse: vNum, text: String(v.text || '') });
        }
      }
    }
  }

  if (out.length === 0) addLog(`No verses found for ${bookName} ${chapterStart}:${verseStart}`, 'warn');
  else addLog(`Extracted ${out.length} verse(s)`, 'dim');
  return out;
}

function showVerse(ref, text, version, path) {
  document.getElementById('verse-ref').textContent  = ref;
  document.getElementById('verse-text').textContent = text || '(No text found)';
  document.getElementById('verse-meta').innerHTML =
    `<span class="badge badge-ok">${escHtml(version)}</span>` +
    `<span class="small">${escHtml(path)}</span>`;
  document.getElementById('verse-card').style.display = 'block';
}

const VERSE_BLOCK_WORDS = 30;

function getSlideHoldMs() {
  return Math.max(2000, (parseInt(document.getElementById('inp-delay')?.value, 10) || 10) * 1000);
}

function splitTextBlocks(text, limit = VERSE_BLOCK_WORDS) {
  const cleaned = String(text || '').replace(/^¶\s*/, '').trim();
  if (!cleaned) return [''];

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return [cleaned];

  const blocks = [];
  let start = 0;
  while (start < words.length) {
    const remaining = words.length - start;
    if (remaining <= limit) {
      blocks.push(words.slice(start).join(' '));
      break;
    }

    let take = limit;
    const minTake = Math.max(1, limit - 10);
    for (let i = limit - 1; i >= minTake; i--) {
      if (/[.;:!?]$/.test(words[start + i])) {
        take = i + 1;
        break;
      }
    }
    blocks.push(words.slice(start, start + take).join(' '));
    start += take;
  }
  return blocks;
}

async function showVerseBlocks(ref, text, version, path, holdMs = getSlideHoldMs(), sessionId = currentZapSessionId, waitThroughLastBlock = false) {
  const blocks = splitTextBlocks(text);
  const token = (window.__verseBlockToken = (window.__verseBlockToken || 0) + 1);
  const blockHoldMs = Math.max(350, Math.round(holdMs / Math.max(1, blocks.length)));

  for (let i = 0; i < blocks.length; i++) {
    if (token !== window.__verseBlockToken || sessionId !== currentZapSessionId) return;
    const blockRef = blocks.length > 1 ? `${ref} (${i + 1}/${blocks.length})` : ref;
    showVerse(blockRef, blocks[i], version, path);

    if (i < blocks.length - 1 || waitThroughLastBlock) {
      startSlideTimer(blockHoldMs);
      await new Promise(resolve => setTimeout(resolve, blockHoldMs));
      stopSlideTimer();
    }
  }
}

function verseAudioDisplayRef(displayBook, verse) {
  const chapter = verse?.chapter ?? '';
  const verseNum = verse?.verse ?? '';
  return `${displayBook} ${chapter}:${verseNum}`.trim();
}

function playBackgroundMusic() {
  if (bgMusic) return;
  bgMusic = new Audio(BG_MUSIC_URL);
  bgMusic.loop   = true;
  bgMusic.volume = Math.min(0.18, currentVolume * 0.28);
  bgMusic.muted  = isMuted;
  bgMusic.play().catch(() => { bgMusic = null; });
}

function setVolume(v) {
  currentVolume = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
  if (currentAudio) currentAudio.volume = currentVolume;
  if (bgMusic) bgMusic.volume = Math.min(0.18, currentVolume * 0.28);
  const pct  = Math.round(currentVolume * 100);
  const disp = document.getElementById('vol-display');
  if (disp) disp.textContent = `${pct}%`;
  addLog(`Volume ${pct}%`, 'dim');
}

function playVoiceFromCdn(range, verses = [], onVerseReady) {
  if (currentAudio) {
    try { currentAudio.pause(); } catch(e) {}
    currentAudio = null;
  }
  if (!range || !range.book) { addLog('Audio failed: invalid range', 'err'); return Promise.resolve(); }

  let queue = [];
  if (verses && verses.length > 0) {
    queue = verses.map(v => ({ chapter: v.chapter || range.chapter_start, verse: v.verse }));
  } else {
    if (range.chapter_start == null || range.verse_start == null) return Promise.resolve();
    queue = [{ chapter: range.chapter_start, verse: range.verse_start }];
  }

  const verDir    = String(range.bible_version || 'KJV').toLowerCase();
  const lookupKey = String(range.book).trim().toLowerCase();
  const bookNum   = BIBLE_NUM_MAP[lookupKey];
  if (!bookNum) { addLog(`Audio skipped: "${range.book}" not in map`, 'warn'); return Promise.resolve(); }

  const pad  = n => String(n).padStart(3, '0');
  const bStr = pad(bookNum);

  return new Promise((resolve) => {
    let idx = 0;
    function playNext() {
      if (idx >= queue.length) { currentAudio = null; resolve(); return; }
      const { chapter, verse } = queue[idx];
      const verseData = verses?.[idx] || { chapter, verse, text: '' };
      const filename = `B${bStr}_C${pad(chapter)}_V${pad(verse)}.mp3`;
      const audioUrl = `${R2_BASE}/${verDir}/${filename}`;
      addLog(`${filename} (${idx + 1}/${queue.length})`, 'info');
      const audio = new Audio(audioUrl);
      audio.preload = 'metadata';
      if (verDir === 'kjv') audio.playbackRate = 0.85;
      audio.volume  = currentVolume;
      audio.muted   = isMuted;
      currentAudio  = audio;
      let started = false;
      let displayPromise = Promise.resolve();

      function startAfterMetadata() {
        if (started) return;
        started = true;
        const rawDuration = Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000
          : getSlideHoldMs();
        const durationMs = verDir === 'kjv' ? rawDuration / 0.85 : rawDuration;
        if (typeof onVerseReady === 'function') {
          displayPromise = Promise.resolve(onVerseReady({
            verse: verseData,
            index: idx,
            count: queue.length,
            durationMs
          }));
        }
        audio.play().catch(err => { addLog(`Audio blocked: ${err.message}`, 'warn'); idx++; playNext(); });
      }

      audio.onloadedmetadata = startAfterMetadata;
      audio.onended = async () => { await displayPromise; idx++; playNext(); };
      audio.onerror = () => { addLog(`Audio error: ${filename}`, 'err'); idx++; playNext(); };
      audio.load();
      setTimeout(startAfterMetadata, 1500);
    }
    playNext();
  });
}

function startSlideTimer(durationMs) {
  const bar  = document.getElementById('slide-timer-bar');
  const wrap = document.getElementById('slide-timer-wrap');
  if (!bar || !wrap) return;
  wrap.style.display   = 'block';
  bar.style.transition = 'none';
  bar.style.width      = '100%';
  void bar.offsetWidth;
  bar.style.transition = `width ${durationMs}ms linear`;
  bar.style.width      = '0%';
}

function stopSlideTimer() {
  const wrap = document.getElementById('slide-timer-wrap');
  const bar  = document.getElementById('slide-timer-bar');
  if (wrap) wrap.style.display = 'none';
  if (bar)  bar.style.width    = '100%';
}

function interruptibleWait(ms) {
  return new Promise(resolve => {
    slideWaitResolve   = resolve;
    _slideTimerTimeout = setTimeout(() => {
      slideWaitResolve = null;
      resolve('timeout');
    }, ms);
  });
}

async function runPsalmsLoop(mySessionId) {
  addLog('No channel slides — Psalms loop 1-150', 'warn');
  document.getElementById('transport-bar').classList.add('active');

  const jsonPath = '/data/bibles/kjv.json';
  let bibleData;
  try { bibleData = await fetchJSON(jsonPath); }
  catch(e) { bibleData = SAMPLE_BIBLE.kjv; }

  const holdMs = getSlideHoldMs();
  let psalmNum = 1;

  while (mySessionId === currentZapSessionId) {
    if (psalmNum > 150) { psalmNum = 1; addLog('Psalms loop restart', 'dim'); }
    const ref    = `Psalms ${psalmNum}`;
    const verses = extractVerses(bibleData, psalmNum, 1, psalmNum, 999, 'Psalms');
    document.getElementById('np-label').textContent = ref;
    addLog(ref, 'dim');
    const r = { book: 'Psalms', bible_version: 'KJV', chapter_start: psalmNum, verse_start: 1 };
    await playVoiceFromCdn(r, verses, ({ verse, durationMs }) =>
      showVerseBlocks(verseAudioDisplayRef('Psalms', verse), verse.text || '(Loading...)', 'KJV', jsonPath, durationMs, mySessionId, true)
    );
    if (mySessionId !== currentZapSessionId) break;
    startSlideTimer(holdMs);
    await interruptibleWait(holdMs);
    stopSlideTimer();
    psalmNum++;
  }
}

function resetRunUI() {
  document.getElementById('btn-stop').style.display = 'none';
  document.getElementById('transport-bar').classList.remove('active');
  isPaused    = false;
  slideRanges = [];
  skipSignal  = null;
  const pp = document.getElementById('btn-playpause');
  if (pp) { pp.textContent = '⏸'; pp.title = 'Pause'; pp.classList.remove('t-on'); }
  const slugGrid = document.getElementById('slug-grid');
  if (slugGrid) slugGrid.querySelectorAll('.slug-btn').forEach(b => b.disabled = false);
  hideBibleKeyboard();
}

async function zapChannel(channelId) {
  const mySessionId = ++currentZapSessionId;
  clearLog();
  addLog(`Zapping ${channelId}`, 'info');

  document.getElementById('btn-stop').style.display = 'block';
  document.getElementById('verse-card').style.display = 'none';
  document.getElementById('transport-bar').classList.add('active');
  isPaused = false;
  const pp = document.getElementById('btn-playpause');
  if (pp) { pp.textContent = '⏸'; pp.title = 'Pause'; pp.classList.remove('t-on'); }

  playBackgroundMusic();

  let ranges;
  try {
    const data = await fetchJSON(`/api/ranges?channel_id=${encodeURIComponent(channelId)}`);
    ranges = data.ranges || data;
    ranges.sort((a, b) => a.order_index - b.order_index);
    addLog(`${ranges.length} slides loaded`, 'ok');
  } catch(e) {
    addLog(`Pipeline error: ${e.message} — Psalms fallback`, 'err');
    await runPsalmsLoop(mySessionId);
    return;
  }

  if (!ranges || ranges.length === 0) {
    await runPsalmsLoop(mySessionId);
    return;
  }

  slideRanges       = ranges;
  currentSlideIndex = 0;

  const bibleCache = {};
  const holdMs = getSlideHoldMs();

  while (mySessionId === currentZapSessionId) {
    if (currentSlideIndex >= slideRanges.length) {
      addLog('Playlist complete — looping', 'dim');
      currentSlideIndex = 0;
    }

    const r = slideRanges[currentSlideIndex];
    const forcedOverride = window.SC_FORCE_LANG || '';
    const activeVersion  = forcedOverride || r.bible_version || 'KJV';
    const jsonPath       = activeVersion === 'LSG' ? '/data/bibles/lsg.json' : '/data/bibles/kjv.json';

    const displayBook = (activeVersion === 'LSG') ? (EN_TO_FR_BOOK[r.book] || r.book) : r.book;
    let ref;
    if (r.chapter_start === r.chapter_end) {
      ref = (r.verse_start === r.verse_end)
        ? `${displayBook} ${r.chapter_start}:${r.verse_start}`
        : `${displayBook} ${r.chapter_start}:${r.verse_start}–${r.verse_end}`;
    } else {
      ref = `${displayBook} ${r.chapter_start}:${r.verse_start}–${r.chapter_end}:${r.verse_end}`;
    }

    addLog(`Slide ${currentSlideIndex + 1}/${slideRanges.length}: ${ref} (${activeVersion})`, 'info');
    document.getElementById('np-label').textContent =
      `${currentSlideIndex + 1}/${slideRanges.length}  ${ref}`;

    if (!bibleCache[jsonPath]) {
      try {
        bibleCache[jsonPath] = await fetchJSON(jsonPath);
        addLog('Bible loaded', 'ok');
      } catch(e) {
        addLog('Using sample Bible data', 'warn');
        bibleCache[jsonPath] = SAMPLE_BIBLE.kjv;
      }
    }

    const verses = extractVerses(bibleCache[jsonPath],
      r.chapter_start, r.verse_start, r.chapter_end, r.verse_end, r.book);
    hideBibleKeyboard();

    if (!isPaused && mySessionId === currentZapSessionId) {
      await playVoiceFromCdn(r, verses, ({ verse, durationMs }) =>
        showVerseBlocks(verseAudioDisplayRef(displayBook, verse), verse.text || '(No text found)', activeVersion, jsonPath, durationMs, mySessionId, true)
      );
    } else {
      const text = verses.map(v => v.text).join(' ');
      await showVerseBlocks(ref, text, activeVersion, jsonPath, holdMs, mySessionId);
    }
    if (mySessionId !== currentZapSessionId) break;

    if (isPaused) {
      await new Promise(resolve => { slideWaitResolve = resolve; });
      slideWaitResolve = null;
      continue;
    }

    startSlideTimer(holdMs);
    const reason = await interruptibleWait(holdMs);
    clearTimeout(_slideTimerTimeout);
    stopSlideTimer();

    if (reason === 'prev') { currentSlideIndex = Math.max(0, currentSlideIndex - 1); skipSignal = null; continue; }
    if (reason === 'next') { currentSlideIndex++; skipSignal = null; continue; }
    currentSlideIndex++;
  }

  addLog('Session ended', 'dim');
  resetRunUI();
}

function hideBibleKeyboard() {
  const panel     = document.getElementById('manual-lookup');
  const grid      = document.getElementById('kb-matrix-grid');
  const actionBar = document.getElementById('lookup-action-bar');
  if (panel)     panel.style.display     = 'none';
  if (grid)      grid.style.display     = 'none';
  if (actionBar) actionBar.style.display = 'none';
}

function resetBibleKeyboardSelection() {
  KB_STATE.step            = 'BOOK';
  KB_STATE.selectedBook    = '';
  KB_STATE.selectedChapter = 1;
  KB_STATE.selectedVerse   = 1;
  KB_STATE.totalChapters   = 0;
  KB_STATE.versesInChapter = 0;

  ['ml-book', 'ml-ch', 'ml-vs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['ml-ch-start', 'ml-vs-start', 'range-ch-start', 'range-vs-start'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '1';
  });
  ['ml-ch-end', 'ml-vs-end', 'range-ch-end', 'range-vs-end'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function showBibleKeyboard(resetSelection = true) {
  const panel     = document.getElementById('manual-lookup');
  const grid      = document.getElementById('kb-matrix-grid');
  const actionBar = document.getElementById('lookup-action-bar');
  if (resetSelection) {
    resetBibleKeyboardSelection();
    renderKeyboardMatrix();
  }
  if (panel)     panel.style.display     = 'flex';
  if (grid)      grid.style.display     = 'grid';
  if (actionBar) {
    actionBar.style.display = '';
    actionBar.classList.add('visible');
  }
}

/* ══════════════════════════════════════════════════════
   BIBLE KEYBOARD MATRIX
══════════════════════════════════════════════════════ */
const KB_STATE = {
  step           : 'BOOK',
  selectedBook   : '',
  selectedChapter: 1,
  selectedVerse  : 1,
  totalChapters  : 0,
  versesInChapter: 0
};

const BIBLE_CAPS = {
  'Genesis':{ch:50},'Exodus':{ch:40},'Leviticus':{ch:27},'Numbers':{ch:36},'Deuteronomy':{ch:34},
  'Joshua':{ch:24},'Judges':{ch:21},'Ruth':{ch:4},'1 Samuel':{ch:31},'2 Samuel':{ch:24},
  '1 Kings':{ch:22},'2 Kings':{ch:25},'1 Chronicles':{ch:29},'2 Chronicles':{ch:36},'Ezra':{ch:10},
  'Nehemiah':{ch:13},'Esther':{ch:10},'Job':{ch:42},'Psalms':{ch:150},'Proverbs':{ch:31},
  'Ecclesiastes':{ch:12},'Song of Solomon':{ch:8},'Isaiah':{ch:66},'Jeremiah':{ch:52},'Lamentations':{ch:5},
  'Ezekiel':{ch:48},'Daniel':{ch:12},'Hosea':{ch:14},'Joel':{ch:3},'Amos':{ch:9},
  'Obadiah':{ch:1},'Jonah':{ch:4},'Micah':{ch:7},'Nahum':{ch:3},'Habakkuk':{ch:3},
  'Zephaniah':{ch:3},'Haggai':{ch:2},'Zechariah':{ch:14},'Malachi':{ch:4},
  'Matthew':{ch:28},'Mark':{ch:16},'Luke':{ch:24},'John':{ch:21},'Acts':{ch:28},
  'Romans':{ch:16},'1 Corinthians':{ch:16},'2 Corinthians':{ch:13},'Galatians':{ch:6},'Ephesians':{ch:6},
  'Philippians':{ch:4},'Colossians':{ch:4},'1 Thessalonians':{ch:5},'2 Thessalonians':{ch:3},
  '1 Timothy':{ch:6},'2 Timothy':{ch:4},'Titus':{ch:3},'Philemon':{ch:1},'Hebrews':{ch:13},
  'James':{ch:5},'1 Peter':{ch:5},'2 Peter':{ch:3},'1 John':{ch:5},'2 John':{ch:1},
  '3 John':{ch:1},'Jude':{ch:1},'Revelation':{ch:22}
};

function initBibleKeyboard() {
  renderKeyboardMatrix();
}

async function renderKeyboardMatrix() {
  const grid        = document.getElementById('kb-matrix-grid');
  const breadcrumbs = document.getElementById('kb-breadcrumbs');
  const backBtn     = document.getElementById('btn-kb-back');
  if (!grid) return;

  grid.dataset.step = KB_STATE.step;
  grid.innerHTML    = '';

  const activeVersion = window.SC_FORCE_LANG || 'KJV';
  const isLSG         = activeVersion === 'LSG';

  /* ── STEP 1 : BOOKS ───────────────────────────────── */
  if (KB_STATE.step === 'BOOK') {
    if (breadcrumbs) breadcrumbs.textContent = 'Select Book';
    if (backBtn) backBtn.style.display = 'none';

    Object.keys(BIBLE_CAPS).forEach(bookName => {
      const btn   = document.createElement('button');
      btn.textContent = isLSG ? (EN_TO_FR_BOOK[bookName] || bookName) : bookName;
      btn.onclick = () => {
        KB_STATE.selectedBook   = bookName;
        KB_STATE.selectedChapter = 1;
        KB_STATE.selectedVerse   = 1;
        KB_STATE.totalChapters  = BIBLE_CAPS[bookName].ch;
        KB_STATE.step           = 'CHAPTER';
        const bookInput = document.getElementById('ml-book');
        if (bookInput) bookInput.value = bookName;
        ['ml-ch', 'ml-vs', 'range-ch-start', 'range-vs-start'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '1';
        });
        showLookupActions();
        renderKeyboardMatrix();
      };
      grid.appendChild(btn);
    });

  /* ── STEP 2 : CHAPTERS ────────────────────────────── */
  } else if (KB_STATE.step === 'CHAPTER') {
    const label = isLSG ? (EN_TO_FR_BOOK[KB_STATE.selectedBook] || KB_STATE.selectedBook) : KB_STATE.selectedBook;
    if (breadcrumbs) breadcrumbs.textContent = `${label} — Select Chapter`;
    if (backBtn) backBtn.style.display = 'block';

    for (let c = 1; c <= KB_STATE.totalChapters; c++) {
      const btn   = document.createElement('button');
      btn.textContent = c;
      btn.onclick = () => {
        KB_STATE.selectedChapter = c;
        KB_STATE.selectedVerse   = 1;
        KB_STATE.step            = 'VERSE';
        const chInput = document.getElementById('ml-ch');
        const vsInput = document.getElementById('ml-vs');
        const rangeCh = document.getElementById('range-ch-start');
        const rangeVs = document.getElementById('range-vs-start');
        if (chInput) chInput.value = c;
        if (vsInput) vsInput.value = '1';
        if (rangeCh) rangeCh.value = c;
        if (rangeVs) rangeVs.value = '1';
        showLookupActions();
        renderKeyboardMatrix();
      };
      grid.appendChild(btn);
    }

  /* ── STEP 3 : VERSES ──────────────────────────────── */
  } else if (KB_STATE.step === 'VERSE') {
    const label = isLSG ? (EN_TO_FR_BOOK[KB_STATE.selectedBook] || KB_STATE.selectedBook) : KB_STATE.selectedBook;
    if (breadcrumbs) breadcrumbs.textContent = `${label} ${KB_STATE.selectedChapter} — Select Verse`;
    if (backBtn) backBtn.style.display = 'block';

    // Fetch real verse count for this chapter
    let maxVerses = 50; // safe fallback
    try {
      const jPath    = isLSG ? '/data/bibles/lsg.json' : '/data/bibles/kjv.json';
      const bData    = await fetchJSON(jPath);
      const bookKey  = Object.keys(bData).find(k =>
        k.toLowerCase() === KB_STATE.selectedBook.toLowerCase()) || KB_STATE.selectedBook;
      const chData   = bData[bookKey]?.[KB_STATE.selectedChapter];
      if (chData) maxVerses = Object.keys(chData).length;
    } catch(e) { /* keep fallback */ }

    for (let v = 1; v <= maxVerses; v++) {
      const btn   = document.createElement('button');
      btn.textContent = v;
      btn.onclick = () => {
        KB_STATE.selectedVerse = v;
        document.getElementById('ml-book').value = KB_STATE.selectedBook;
        document.getElementById('ml-ch').value   = KB_STATE.selectedChapter;
        document.getElementById('ml-vs').value   = v;
        document.getElementById('range-ch-start').value = KB_STATE.selectedChapter;
        document.getElementById('range-vs-start').value = v;
        triggerBibleMatrixLookup();
      };
      grid.appendChild(btn);
    }
    // Show action bar once book+chapter+verse are available
    showLookupActions();
  }
}

function navigateKbBack() {
  if      (KB_STATE.step === 'VERSE')   KB_STATE.step = 'CHAPTER';
  else if (KB_STATE.step === 'CHAPTER') KB_STATE.step = 'BOOK';
  renderKeyboardMatrix();
}

async function triggerBibleMatrixLookup() {
  const book = document.getElementById('ml-book').value.trim();
  let chS = parseInt(document.getElementById('ml-ch-start')?.value)
          || parseInt(document.getElementById('ml-ch').value) || 1;
  let vsS = parseInt(document.getElementById('ml-vs-start')?.value)
          || parseInt(document.getElementById('ml-vs').value) || 1;
  let chE = parseInt(document.getElementById('ml-ch-end')?.value) || chS;
  let vsE = parseInt(document.getElementById('ml-vs-end')?.value) || 999;

  if (!book) return;

  addLog(`Matrix: ${book} ${chS}:${vsS}`, 'info');
  const activeVersion = window.SC_FORCE_LANG || 'KJV';
  const jsonPath      = activeVersion === 'LSG' ? '/data/bibles/lsg.json' : '/data/bibles/kjv.json';

  let bibleData;
  try { bibleData = await fetchJSON(jsonPath); }
  catch(e) { addLog('Cannot load Bible', 'err'); return; }

  const displayBook = (activeVersion === 'LSG') ? (EN_TO_FR_BOOK[book] || book) : book;
  const ref = `${displayBook} ${chS}:${vsS}`
            + (chE !== chS || vsE !== vsS ? `–${chE}:${vsE}` : '');
  const verses = extractVerses(bibleData, chS, vsS, chE, vsE, book);
  if (verses.length > 0) {
    const r = { book, bible_version: activeVersion,
                chapter_start: chS, verse_start: vsS,
                chapter_end: chE,   verse_end:   vsE };
    await playVoiceFromCdn(r, verses, ({ verse, durationMs }) =>
      showVerseBlocks(verseAudioDisplayRef(displayBook, verse), verse.text || '(Verse not found)', activeVersion, jsonPath, durationMs, currentZapSessionId, true)
    );
  } else {
    await showVerseBlocks(ref, '(Verse not found)', activeVersion, jsonPath);
  }

  // Reset to BOOK step for next lookup
  resetBibleKeyboardSelection();
  renderKeyboardMatrix();
}

function getCurrentManualRange() {
  return {
    book:          document.getElementById('ml-book').value,
    bible_version: (window.SC_FORCE_LANG === 'LSG') ? 'LSG' : 'KJV',
    chapter_start: parseInt(document.getElementById('range-ch-start')?.value) || 1,
    verse_start:   parseInt(document.getElementById('range-vs-start')?.value) || 1,
    chapter_end:   parseInt(document.getElementById('range-ch-end')?.value)   || null,
    verse_end:     parseInt(document.getElementById('range-vs-end')?.value)   || null
  };
}

/* ══════════════════════════════════════════════════════
   SLUG CHANNEL GRID
══════════════════════════════════════════════════════ */
async function loadAndRenderSlugs() {
  const grid     = document.getElementById('slug-grid');
  const channels = [
    { id: "61580e26-3bcf-4e9d-b312-4a7c6fc5681c", name: "LOVE"              },
    { id: "b7af28b1-5fb6-4642-aa36-297ee356eef2", name: "Morning Devotional" },
    { id: "157f90e3-1e24-40a3-bab1-ec99ea562871", name: "PATIENCE"           },
    { id: "53ef375e-101c-46f5-a224-598baa7e44bc", name: "PEACE"              },
    { id: "dbb9397a-36a6-404a-9f3e-aa98fdff56dc", name: "SALVATION"          },
    { id: "91591c77-2bb7-473e-bc05-a2dbee608ca4", name: "TEMPERANCE"         },
    { id: "540532e7-d370-4a99-a713-3473ba2945c5", name: "TEST CHANNEL"       }
  ];

  grid.innerHTML = '';
  channels.forEach(ch => {
    const btn           = document.createElement('button');
    btn.className       = 'slug-btn';
    btn.textContent     = ch.name.toUpperCase();
    btn.dataset.uuid    = ch.id;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.slug-btn').forEach(b => { b.classList.remove('active'); b.disabled = true; });
      btn.classList.add('active');
      document.getElementById('inp-uuid').value = ch.id;
      zapChannel(ch.id);
      toggleControlPanel(true);
    });
    grid.appendChild(btn);
  });
  addLog(`${channels.length} channels loaded`, 'ok');
}

/* ══════════════════════════════════════════════════════
   MANUAL LOOKUP — ACTION BAR
══════════════════════════════════════════════════════ */
function showLookupActions() {
  const bar = document.getElementById('lookup-action-bar');
  if (bar) bar.classList.add('visible');
}

function toggleRangeSubform() {
  const f = document.getElementById('range-subform');
  if (f) f.classList.toggle('visible');
}

function lookupPlayNow() {
  const { selectedBook, selectedChapter, selectedVerse } = KB_STATE;
  if (!selectedBook) { addLog('Select a book first', 'warn'); return; }
  const ver = (window.SC_FORCE_LANG === 'LSG') ? 'LSG' : 'KJV';
  _runLookupRange({
    book: selectedBook, bible_version: ver,
    chapter_start: selectedChapter, verse_start: selectedVerse,
    chapter_end:   selectedChapter, verse_end:   selectedVerse
  });
}

function lookupPlayAll() {
  const { selectedBook } = KB_STATE;
  if (!selectedBook) { addLog('Select a book first', 'warn'); return; }
  const caps = BIBLE_CAPS[selectedBook];
  if (!caps) { addLog('Book not in BIBLE_CAPS', 'warn'); return; }
  const ver = (window.SC_FORCE_LANG === 'LSG') ? 'LSG' : 'KJV';
  addLog(`Playing entire book: ${selectedBook}`, 'info');
  _runLookupRange({
    book: selectedBook, bible_version: ver,
    chapter_start: 1, verse_start: 1,
    chapter_end: caps.ch, verse_end: 999
  });
}

function lookupPlayRange() {
  const { selectedBook } = KB_STATE;
  if (!selectedBook) { addLog('Select a book first', 'warn'); return; }
  const chS = parseInt(document.getElementById('range-ch-start').value) || 1;
  const vsS = parseInt(document.getElementById('range-vs-start').value) || 1;
  const chE = parseInt(document.getElementById('range-ch-end').value)   || chS;
  const vsE = parseInt(document.getElementById('range-vs-end').value)   || 999;
  const ver = (window.SC_FORCE_LANG === 'LSG') ? 'LSG' : 'KJV';
  addLog(`Playing range: ${selectedBook} ${chS}:${vsS} - ${chE}:${vsE}`, 'info');
  _runLookupRange({
    book: selectedBook, bible_version: ver,
    chapter_start: chS, verse_start: vsS,
    chapter_end:   chE, verse_end:   vsE
  });
}

function lookupAddToPlaylist() {
  const range = getCurrentManualRange();
  if (!range.book) { addLog('Select a verse first', 'warn'); return; }
  manualPlaylist.push({ ...range, order_index: manualPlaylist.length });
  renderPlaylist();
  addLog(`OK Added: ${range.book} ${range.chapter_start}:${range.verse_start}`, 'ok');
}

function removeFromPlaylist(idx) {
  manualPlaylist.splice(idx, 1);
  manualPlaylist.forEach((e, i) => { e.order_index = i; });
  renderPlaylist();
}

function renderPlaylist() {
  const panel = document.getElementById('playlist-panel');
  if (!panel) return;
  if (!manualPlaylist.length) { panel.innerHTML = ''; return; }
  panel.innerHTML = manualPlaylist.map((e, i) =>
    `<div class="pl-row">
      <span class="pl-ref">${e.book} ${e.chapter_start}:${e.verse_start}</span>
      <span class="pl-del" onclick="removeFromPlaylist(${i})">✕</span>
    </div>`
  ).join('');
}

async function _runLookupRange(r) {
  const ver      = String(r.bible_version || 'KJV').toUpperCase();
  const jsonPath = ver === 'LSG' ? '/data/bibles/lsg.json' : '/data/bibles/kjv.json';
  let bibleData;
  try { bibleData = await fetchJSON(jsonPath); }
  catch(e) { addLog(`Cannot load Bible: ${e.message}`, 'err'); return; }

  const verses = extractVerses(bibleData,
    r.chapter_start, r.verse_start, r.chapter_end, r.verse_end, r.book);
  if (!verses.length) { addLog('No verses found', 'warn'); return; }

  const displayBook = (ver === 'LSG') ? (EN_TO_FR_BOOK[r.book] || r.book) : r.book;
  const ref = `${displayBook} ${r.chapter_start}:${r.verse_start}` +
              (verses.length > 1 ? ` … (${verses.length} verses)` : '');

  hideBibleKeyboard();
  await playVoiceFromCdn(r, verses, ({ verse, durationMs }) =>
    showVerseBlocks(verseAudioDisplayRef(displayBook, verse), verse.text || '(No text found)', ver, jsonPath, durationMs, currentZapSessionId, true)
  );
  resetBibleKeyboardSelection();
  renderKeyboardMatrix();
}
