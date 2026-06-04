'use strict';

/* ══════════════════════════════════════════════════════
   CONSTANTS & STATE GLOBAL STORAGE
══════════════════════════════════════════════════════ */
const R2_BASE     = 'https://audio.selahpoint.uk';
const BG_MUSIC_URL = './audio/ambient-nature.mp3';

// Session / audio
let currentZapSessionId = 0;
let currentAudio        = null;
let bgMusic             = null;
let isMuted             = false;
let currentVolume       = 0.65;

// Transport / loop
let currentSlideIndex  = 0;
let slideRanges        = [];
let isPaused           = false;
let skipSignal         = null;       // 'next' | 'prev' | null
let slideWaitResolve   = null;
let _slideTimerTimeout = null;

// Language
window.SC_FORCE_LANG = null;

// Prayer alarms
const prayerAlarms  = [];
let prayerAlarmDate = '';
let manualPlaylist = []; // manual lookup playlist
