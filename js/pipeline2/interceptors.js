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
   SNIPPET 3 — LSG data passthrough
══════════════════════════════════════════════════════ */
(function () {
  const _origFetch = window.fetch;
  window.fetch = async function (url, options) {
    return _origFetch.call(this, url, options);
  };
})();