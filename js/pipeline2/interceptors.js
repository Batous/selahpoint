'use strict';

/* ══════════════════════════════════════════════════════
   SNIPPET 1 — Language state
══════════════════════════════════════════════════════ */
function setLang(lang) {
  window.SC_FORCE_LANG = lang || null;
  const inp = document.getElementById('inp-version');
  if (inp) inp.value = lang || '';
  document.getElementById('btn-lang-en').classList.toggle('lang-active', lang === 'KJV');
  document.getElementById('btn-lang-fr').classList.toggle('lang-active', lang === 'LSG');
  addLog(`🌐 Language → ${lang || 'AUTO'}`, 'info');
}

/* ══════════════════════════════════════════════════════
   SNIPPET 2 — Audio URL interceptor (lang override)
══════════════════════════════════════════════════════ */
(function () {
  const _OrigAudio = window.Audio;
  window.Audio = function (url) {
    if (url && window.SC_FORCE_LANG && typeof url === 'string') {
      const want = window.SC_FORCE_LANG.toLowerCase();
      const corrected = url.replace(
        /(audio\.selahpoint\.uk\/)(kjv|lsg)(\/)/i,
        (_, host, found, slash) => `${host}${want}${slash}`
      );
      if (corrected !== url) {
        const from = url.match(/\/(kjv|lsg)\//i)?.[1] ?? '?';
        addLog(`🔄 Audio lang: /${from}/ → /${want}/`, 'warn');
        url = corrected;
      }
    }
    return new _OrigAudio(url);
  };
})();

/* ══════════════════════════════════════════════════════
   SNIPPET 3 — LSG book-name normalizer
══════════════════════════════════════════════════════ */
(function () {
  const FR_TO_EN = {
    'nombres':'Numbers','josue':'Joshua','juges':'Judges',
    '1 rois':'1 Kings','2 rois':'2 Kings','esdras':'Ezra',
    'psaumes':'Psalms',
    'cantique des cantiques':'Song of Solomon',
    'cantique de salomon':'Song of Solomon',
    'esaie':'Isaiah','ezechiel':'Ezekiel',
    'osee':'Hosea','abdias':'Obadiah','michee':'Micah',
    'habacuc':'Habakkuk','sophonie':'Zephaniah',
    'aggee':'Haggai','zacharie':'Zechariah','malachie':'Malachi',
    'marc':'Mark','luc':'Luke','jean':'John','actes':'Acts',
    '1 jean':'1 John','2 jean':'2 John','3 jean':'3 John',
    '1 pierre':'1 Peter','2 pierre':'2 Peter',
    'tite':'Titus','jacques':'James','apocalypse':'Revelation',
    'cantique':'Song of Solomon','ct':'Song of Solomon','sg':'Song of Solomon',
  };

  function frNorm(s) {
    if (!s) return '';
    try { return String(s).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
    catch(e) { return String(s).trim().toLowerCase().replace(/[\u0300-\u036f]/g,''); }
  }
  function translate(name) { const en = FR_TO_EN[frNorm(name)]; return en || name; }

  function normalizeLsgData(data) {
    if (data && data.verses && Array.isArray(data.verses)) {
      let n = 0;
      data.verses.forEach(v => { const e = translate(v.book_name); if (e !== v.book_name) { v.book_name = e; n++; } });
      if (n) addLog(`🔤 LSG FR→EN: ${n} names translated`, 'dim');
    } else if (Array.isArray(data)) {
      let n = 0;
      data.forEach(b => {
        const e = translate(b.name); if (e !== b.name) { b.name = e; n++; }
        if (b.slug) { const es = translate(b.slug); if (es !== b.slug) b.slug = es; }
      });
      if (n) addLog(`🔤 LSG FR→EN: ${n} names translated`, 'dim');
    }
    return data;
  }

  const _origFetch = window.fetch;
  window.fetch = async function (url, options) {
    const response = await _origFetch.call(this, url, options);
    if (typeof url === 'string' && url.includes('/bibles/lsg')) {
      try {
        const raw = await response.clone().json();
        const normalized = normalizeLsgData(raw);
        return new Response(JSON.stringify(normalized), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) { /* pass through */ }
    }
    return response;
  };
})();