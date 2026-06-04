'use strict';

/* ══════════════════════════════════════════════════════
   DOM LIFECYCLE EVENT LISTENERS & HOOKS
══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {

  loadAndRenderSlugs();
  initBibleKeyboard(); // <-- Add this single line here
  hideBibleKeyboard();

  function toggleControlPanel(forceCollapse) {
    const panel   = document.querySelector('.left-col .panel');
    const leftCol = document.querySelector('.left-col');
    const btn     = document.getElementById('btn-collapse');
    const gearBtn = document.getElementById('drawer-toggle');
    const collapse = forceCollapse ?? !(panel && panel.classList.contains('collapsed'));
    if (panel) panel.classList.toggle('collapsed', collapse);
    if (btn) btn.textContent = collapse ? '>>>' : '<<<';
    // Drive drawer: hide left-col during playback, show on pause/stop
    if (leftCol) leftCol.classList.toggle('drawer-hidden', !!collapse);
    if (gearBtn) gearBtn.classList.toggle('visible', !!collapse);
    document.body.classList.toggle('playing', !!collapse);
  }
  window.toggleControlPanel = toggleControlPanel;

  function tickClock() {
    const el  = document.getElementById('terminal-clock');
    if (!el) return;
    const now  = new Date();
    const lang = (window.SC_FORCE_LANG === 'LSG') ? 'fr-FR' : 'en-GB';
    el.textContent = now.toLocaleTimeString(lang, { hour12: false });
  }
  tickClock();
  setInterval(tickClock, 1000);
  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
    return el;
  }

  const btnClear = bindClick('btn-clear', clearLog);
  const btnHelp = bindClick('btn-help', () => {
    const panel = document.getElementById('log-panel');
    if (panel) panel.classList.toggle('log-visible');
  });
  const btnStop = bindClick('btn-stop', () => {
    currentZapSessionId++;
    if (currentAudio) { try { currentAudio.pause(); } catch(e) {} currentAudio = null; }
    clearTimeout(_slideTimerTimeout);
    if (slideWaitResolve) { slideWaitResolve('stop'); slideWaitResolve = null; }
    if (bgMusic) { bgMusic.pause(); bgMusic = null; }
    resetRunUI();
    addLog('Stop requested by user', 'warn');
  });

  bindClick('btn-playpause', () => {
    const btn = document.getElementById('btn-playpause');
    if (isPaused) {
      isPaused = false;
      btn.textContent = '⏸'; btn.title = 'Pause'; btn.classList.remove('t-on');
      if (currentAudio) currentAudio.play().catch(() => {});
      if (slideWaitResolve) { slideWaitResolve('resume'); slideWaitResolve = null; }
    } else {
      isPaused = true;
      btn.textContent = '▶'; btn.title = 'Resume'; btn.classList.add('t-on');
      if (currentAudio) currentAudio.pause();
      clearTimeout(_slideTimerTimeout);
      stopSlideTimer();
    }
  });

  bindClick('btn-next', () => {
    skipSignal = 'next';
    isPaused   = false;
    const pp = document.getElementById('btn-playpause');
    if (pp) { pp.textContent = '⏸'; pp.title = 'Pause'; pp.classList.remove('t-on'); }
    if (currentAudio) { try { currentAudio.pause(); } catch(e) {} currentAudio = null; }
    clearTimeout(_slideTimerTimeout);
    if (slideWaitResolve) { slideWaitResolve('next'); slideWaitResolve = null; }
  });

  bindClick('btn-prev', () => {
    skipSignal = 'prev';
    isPaused   = false;
    const pp = document.getElementById('btn-playpause');
    if (pp) { pp.textContent = '⏸'; pp.title = 'Pause'; pp.classList.remove('t-on'); }
    if (currentAudio) { try { currentAudio.pause(); } catch(e) {} currentAudio = null; }
    clearTimeout(_slideTimerTimeout);
    if (slideWaitResolve) { slideWaitResolve('prev'); slideWaitResolve = null; }
  });

  bindClick('btn-channel-swap', () => {
    toggleControlPanel(false);
    document.querySelectorAll('.slug-btn').forEach(b => b.disabled = false);
  });

  bindClick('btn-bible-keyboard', () => {
    showBibleKeyboard();
  });

  bindClick('btn-mute', () => {
    isMuted = !isMuted;
    const btn = document.getElementById('btn-mute');
    btn.textContent = isMuted ? '🔈' : '🔇';
    btn.title       = isMuted ? 'Unmute' : 'Mute';
    btn.classList.toggle('t-on', isMuted);
    if (currentAudio) currentAudio.muted = isMuted;
    if (bgMusic) bgMusic.muted = isMuted;
    addLog(isMuted ? '🔇 Muted' : '🔊 Unmuted', 'dim');
  });

  bindClick('btn-vol-down', () => setVolume(currentVolume - 0.1));
  bindClick('btn-vol-up', () => setVolume(currentVolume + 0.1));

 // APRÈS  
const lookupBtn = document.getElementById('btn-lookup');
if (lookupBtn) lookupBtn.addEventListener('click', async () => {
    const book = document.getElementById('ml-book').value.trim();
    const ch   = parseInt(document.getElementById('ml-ch').value) || 1;
    const vs   = parseInt(document.getElementById('ml-vs').value) || 1;
    if (!book) { addLog('⚠ Enter a book name for lookup', 'warn'); return; }

    addLog(`🔍 Manual: ${book} ${ch}:${vs}`, 'info');
    const activeVersion = window.SC_FORCE_LANG || 'KJV';
    const jsonPath      = activeVersion === 'LSG' ? '/data/bibles/lsg.json' : '/data/bibles/kjv.json';

    let bibleData;
    try { bibleData = await fetchJSON(jsonPath); }
    catch(e) { addLog('❌ Cannot load Bible for lookup', 'err'); return; }

    const displayBook = (activeVersion === 'LSG') ? (EN_TO_FR_BOOK[book] || book) : book;
    const ref    = `${displayBook} ${ch}:${vs}`;
    const verses = extractVerses(bibleData, ch, vs, ch, vs, book);
    const text   = verses.map(v => v.text).join(' ');
    if (verses.length > 0) {
      const r = { book, bible_version: activeVersion, chapter_start: ch, verse_start: vs };
      await Promise.all([
        playVoiceFromCdn(r, verses),
        showVerseBlocks(ref, text || '(Verse not found)', activeVersion, jsonPath)
      ]);
    } else {
      await showVerseBlocks(ref, '(Verse not found)', activeVersion, jsonPath);
    }
  });

  // Step 4 — tap verse-card to show/hide transport bar
  const verseCard = document.getElementById('verse-card');
  if (verseCard) {
    verseCard.addEventListener('click', () => {
      const bar = document.getElementById('transport-bar');
      if (bar) bar.classList.toggle('transport-visible');
    });
  }

  renderAlarmList();

  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices());
  }
});
