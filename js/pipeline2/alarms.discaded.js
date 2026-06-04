'use strict';

/* ══════════════════════════════════════════════════════
   PRAYER ALARM SCHEDULER ENGINE
══════════════════════════════════════════════════════ */
function renderAlarmList() {
  const list = document.getElementById('alarm-list');
  if (!list) return;
  list.innerHTML = '';
  if (prayerAlarms.length === 0) {
    list.innerHTML = '<p style="font-family:var(--mono);font-size:.75rem;color:var(--muted);">No alarms set.</p>';
    return;
  }
  prayerAlarms.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'alarm-list-row';
    row.innerHTML = `
      <span class="al-time">${escHtml(a.time)}</span>
      <span class="al-lbl">${escHtml(a.label)}</span>
      <button class="alarm-del" title="Delete alarm">✕</button>
    `;
    row.querySelector('.alarm-del').addEventListener('click', () => {
      prayerAlarms.splice(i, 1);
      renderAlarmList();
      addLog(`🗑 Alarm removed: ${a.time}`, 'dim');
    });
    list.appendChild(row);
  });
}

function checkPrayerAlarms() {
  const now      = new Date();
  const todayStr = now.toDateString();

  if (prayerAlarmDate !== todayStr) {
    prayerAlarmDate = todayStr;
    prayerAlarms.forEach(a => { a.firedWarning = false; a.firedAlert = false; });
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const alarm of prayerAlarms) {
    const [hh, mm] = alarm.time.split(':').map(Number);
    const alarmMin = hh * 60 + mm;

    if (!alarm.firedWarning && nowMin === alarmMin - 2) {
      alarm.firedWarning = true;
      speakPrayerWarning(alarm.label);
    }
    if (!alarm.firedAlert && nowMin === alarmMin) {
      alarm.firedAlert = true;
      showPrayerAlert(alarm.label);
    }
  }
}

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

function showPrayerAlert(label) {
  addLog(`🙏 PRAYER TIME: ${label}`, 'ok');
  const overlay = document.getElementById('prayer-alert');
  const banner  = document.getElementById('prayer-alert-banner');
  if (!overlay || !banner) return;
  banner.textContent     = `🙏  ${label}`;
  overlay.style.display  = 'block';
  banner.style.display   = 'block';
  setTimeout(() => {
    overlay.style.display = 'none';
    banner.style.display  = 'none';
  }, 3 * 60 * 1000);
  
  // js/pipeline2/alarms.js
'use strict';

let _alarms = [];

function addAlarm() {
  const timeInput  = document.getElementById('inp-prayer-time');
  const labelInput = document.getElementById('inp-prayer-label');
  const time  = timeInput.value.trim();
  const label = labelInput.value.trim() || 'Prayer Time';

  if (!time) {
    addLog('⚠ Please pick a time before adding an alarm.', 'warn');
    return;
  }

  _alarms.push({ time, label });
  timeInput.value  = '';
  labelInput.value = '';
  renderAlarmList();
  addLog(`🔔 Alarm added: ${time} — ${label}`, 'ok');
}

function deleteAlarm(index) {
  const removed = _alarms.splice(index, 1);
  renderAlarmList();
  addLog(`🗑 Alarm removed: ${removed[0].time}`, 'dim');
}

function renderAlarmList() {
  const list = document.getElementById('alarm-list');
  if (!list) return;
  if (_alarms.length === 0) { list.innerHTML = ''; return; }

  list.innerHTML = _alarms.map((a, i) => `
    <div class="alarm-list-row">
      <span class="al-time">${a.time}</span>
      <span class="al-lbl">${a.label}</span>
      <button class="alarm-del" onclick="deleteAlarm(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

function checkAlarms() {
  const now = new Date();
  const hhmm = now.getHours().toString().padStart(2,'0') + ':' +
               now.getMinutes().toString().padStart(2,'0');
  const hhmm2min = new Date(now.getTime() - 2 * 60000);
  const pre = hhmm2min.getHours().toString().padStart(2,'0') + ':' +
              hhmm2min.getMinutes().toString().padStart(2,'0');

  _alarms.forEach(a => {
    // Orange border alert — exact time, 3 minutes
    if (a.time === hhmm && !a._alertFired) {
      a._alertFired = true;
      triggerPrayerAlert(a.label);
      setTimeout(() => { a._alertFired = false; }, 4 * 60 * 1000);
    }
    // Voice reminder — 2 min before
    if (a.time === pre && !a._preFired) {
      a._preFired = true;
      addLog(`🔔 2-min reminder: ${a.label} at ${a.time}`, 'warn');
      setTimeout(() => { a._preFired = false; }, 4 * 60 * 1000);
    }
  });
}

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
}