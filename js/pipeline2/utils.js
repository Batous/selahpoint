'use strict';

/* ══════════════════════════════════════════════════════
   DOM REFERENCES & REUSED UTILITIES
══════════════════════════════════════════════════════ */
const logEl = document.getElementById('log');

function ts() { return new Date().toLocaleTimeString('en-GB', { hour12: false }); }

function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function addLog(msg, level = 'info') {
  if (!logEl) {
    const logFn = level === 'err' ? console.error : level === 'warn' ? console.warn : console.log;
    logFn(`[${level}] ${msg}`);
    return;
  }
  const e = document.createElement('div');
  e.className = `log-entry ${level}`;
  e.innerHTML = `<span class="ts">${ts()}</span><span class="msg">${escHtml(msg)}</span>`;
  logEl.appendChild(e);
  logEl.scrollTop = logEl.scrollHeight;
}
function clearLog() {
  if (logEl) logEl.textContent = '';
}

async function fetchJSON(url, timeoutMs = 15000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function normalizeStr(s) {
  if (s == null) return '';
  try { return String(s).trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,''); }
  catch(e) { return String(s).trim().toLowerCase().replace(/[\u0300-\u036f]/g,''); }
}

function bookMatchesValue(queryNorm, candidateVal) {
  if (!candidateVal) return false;
  const c = normalizeStr(candidateVal);
  const q = normalizeStr(queryNorm);
  return c === q || c.startsWith(q.slice(0,4));
}