// js/pipeline2/alarms.js
'use strict';


/* ── AJOUTER / SUPPRIMER ── */
function addAlarm() {
  const timeInput  = document.getElementById('inp-prayer-time');
  const labelInput = document.getElementById('inp-prayer-label');
  const time  = timeInput.value.trim();
  const label = labelInput.value.trim() || 'Prayer Time';
  if (!time) {
    addLog('⚠ Please pick a time before adding an alarm.', 'warn');
    return;
  }
  prayerAlarms.push({ time, label, firedWarning: false, firedAlert: false });
  timeInput.value  = '';
  labelInput.value = '';
  renderAlarmList();
  addLog(`🔔 Alarm added: ${time} — ${label}`, 'ok');
}

function deleteAlarm(index) {
  const removed = prayerAlarms.splice(index, 1);
  renderAlarmList();
  addLog(`🗑 Alarm removed: ${removed[0].time}`, 'dim');
}

function renderAlarmList() {
  const list = document.getElementById('alarm-list');
  if (!list) return;
  if (prayerAlarms.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = prayerAlarms.map((a, i) => `
    <div class="alarm-list-row">
      <span class="al-time">${a.time}</span>
      <span class="al-lbl">${a.label}</span>
      <button class="alarm-del" onclick="deleteAlarm(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

/* ── TICK (appelé depuis init.js) ── */
function checkAlarms() {
  const now      = new Date();
  const todayStr = now.toDateString();

  /* Reset fired flags à minuit */
  if (prayerAlarmDate !== todayStr) {
    prayerAlarmDate = todayStr;
    prayerAlarms.forEach(a => { a.firedWarning = false; a.firedAlert = false; });
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const alarm of prayerAlarms) {
    const [hh, mm] = alarm.time.split(':').map(Number);
    const alarmMin = hh * 60 + mm;

    /* Avertissement vocal 2 min avant */
    if (!alarm.firedWarning && nowMin === alarmMin - 2) {
      alarm.firedWarning = true;
      speakPrayerWarning(alarm.label);
    }
    /* Heure exacte → alerte visuelle */
    if (!alarm.firedAlert && nowMin === alarmMin) {
      alarm.firedAlert = true;
      showPrayerAlert(alarm.label);
    }
  }
}

/* ── VOIX ── */
function speakPrayerWarning(label) {
  addLog(`🔔 Prayer reminder in 2 min: ${label}`, 'warn');
  if (!('speechSynthesis' in window)) return;
  setTimeout(() => {
    const msg  = new SpeechSynthesisUtterance(`Prayer time in 2 minutes. ${label}.`);
    msg.rate   = 0.88;
    msg.pitch  = 1;
    msg.volume = 1;
    const voices = speechSynthesis.getVoices();
    const pref   = voices.find(v => v.lang.startsWith('en') && v.localService)
                || voices.find(v => v.lang.startsWith('en'));
    if (pref) msg.voice = pref;
    speechSynthesis.cancel();
    speechSynthesis.speak(msg);
  }, 120);
}

/* ── ALERTE VISUELLE ── */
function showPrayerAlert(label) {
  addLog(`🙏 PRAYER TIME: ${label}`, 'ok');
  const overlay = document.getElementById('prayer-alert');
  const banner  = document.getElementById('prayer-alert-banner');
  if (!overlay || !banner) return;
  banner.textContent    = `🙏  ${label}`;
  overlay.style.display = 'block';
  banner.style.display  = 'block';
  setTimeout(() => {
    overlay.style.display = 'none';
    banner.style.display  = 'none';
  }, 3 * 60 * 1000);
}