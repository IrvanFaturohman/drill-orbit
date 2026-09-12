'use strict';

/* ============ haptics ============
   Vibration API. Android Chrome supports it; iOS Safari does NOT expose navigator.vibrate
   at all, so on iPhone every call here is a silent no-op and the game has to feel complete
   without it — haptics decorate the screen shake, they never replace it.
   Everything is a short discrete pulse keyed to an event. Nothing is ever held or looped:
   a continuous buzz reads as a malfunction and eats battery. */
const Haptics = {
  get ok() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      && !(Save.data && Save.data.haptics === false);
  },
  fire(pattern) {
    if (!this.ok) return;
    /* a denied or unsupported call must never take a frame down with it */
    try { navigator.vibrate(pattern); } catch (e) { /* no haptics here */ }
  },
  /* meteor hitting the ground. k = normalised impact energy (1 = a Lv1 PERFECT).
     Two pulses: the strike, then the ground settling under it. */
  impact(k) {
    const s = U.clamp(k, 0.1, 2);
    const hit = Math.round(18 + 42 * Math.min(s, 1.5));
    this.fire(s > 0.55 ? [hit, 40, Math.round(hit * 0.45)] : [hit]);
  },
  launch(perfect) { this.fire(perfect ? [12, 28, 22] : [12]); },
  /* passing a strata band mid-penetration — deliberately tiny, it fires several times */
  tick(k) { this.fire(Math.round(6 + 10 * U.clamp(k, 0, 1))); },
  rare() { this.fire([16, 45, 16, 45, 40]); },
  /* the drill finally stopping */
  settle() { this.fire([30, 60, 14]); },
  setEnabled(on) {
    Save.data.haptics = !!on;
    Save.save();
    if (!on && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(0); } catch (e) { /* already silent */ }
    }
  },
};

/* ============ procedural WebAudio SFX (no assets) ============ */

const SFX = (function () {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  let drillNodes = null;
  let windNext = 0;          // next time a wind grain may fire (see wind())
  let whistleNext = 0;       // ...and for the PERFECT descent whistle

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);

    const len = ac.sampleRate * 1.2;
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function ready() {
    if (!ac) init();
    if (!ac) return false;
    if (ac.state === 'suspended') ac.resume();
    return !muted;
  }

  /* pitched blip */
  function tone(o) {
    if (!ready()) return;
    const t = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + o.dur + 0.03);
  }

  /* filtered noise hit */
  function noise(o) {
    if (!ready()) return;
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ac.createBiquadFilter();
    flt.type = o.type || 'lowpass';
    flt.frequency.setValueAtTime(o.f, t);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(60, o.f2), t + o.dur);
    flt.Q.value = o.q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + o.dur + 0.03);
  }

  /* low sine with a fast pitch drop — the body a phone speaker can actually move */
  function thump(f0, f1, dur, vol) {
    if (!ready()) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  return {
    init,
    setMuted(m) { muted = m; if (m) API_stopDrill(); },
    isMuted: () => muted,

    charge() {
      tone({ f: 160, f2: 520, dur: 0.11, type: 'sawtooth', vol: 0.16 });
    },
    launch(power) {
      thump(150, 42, 0.4, 0.85);
      tone({ f: 90, f2: 620, dur: 0.34, type: 'sawtooth', vol: 0.34 });
      noise({ f: 400, f2: 2600, dur: 0.4, vol: 0.34, type: 'bandpass', q: 0.8 });
      if (power > 0.92) {
        tone({ f: 700, f2: 1500, dur: 0.28, type: 'square', vol: 0.14, delay: 0.04 });
        tone({ f: 1046, dur: 0.3, type: 'triangle', vol: 0.18, delay: 0.1 });
      }
    },
    tick() { tone({ f: 900, dur: 0.03, type: 'square', vol: 0.05 }); },
    thud() {
      thump(130, 30, 0.42, 0.9);
      noise({ f: 260, f2: 80, dur: 0.3, vol: 0.34 });
    },
    pick(step) {
      const n = U.clamp(step, 0, 11);
      const base = 520 * Math.pow(1.11, n);
      thump(base * 0.28, base * 0.16, 0.11, 0.28);
      tone({ f: base, f2: base * 1.6, dur: 0.13, type: 'triangle', vol: 0.3 });
      tone({ f: base * 2, dur: 0.09, type: 'sine', vol: 0.13, delay: 0.02 });
    },
    rare() {
      [0, 0.09, 0.18, 0.3].forEach((d, i) => {
        tone({ f: 523 * Math.pow(1.26, i), dur: 0.4, type: 'triangle', vol: 0.24, delay: d });
      });
      noise({ f: 5000, f2: 1200, dur: 0.7, vol: 0.14, type: 'bandpass', q: 0.6 });
    },
    soClose() {
      tone({ f: 780, f2: 620, dur: 0.16, type: 'triangle', vol: 0.22 });
      tone({ f: 520, dur: 0.14, type: 'sine', vol: 0.14, delay: 0.09 });
    },
    overdriveHit() {
      thump(190, 38, 0.5, 1.0);
      noise({ f: 2600, f2: 200, dur: 0.5, vol: 0.4, type: 'bandpass', q: 0.7 });
      tone({ f: 320, f2: 1100, dur: 0.35, type: 'sawtooth', vol: 0.26 });
    },
    /* METEOR IMPACT. Three layers so it lands on a phone speaker: a very low body that
       drops fast, a wide noise blast for the debris, and a short crack on top. `k` is the
       normalised impact energy (1 = a Lv1 PERFECT), so a weak crash really is smaller. */
    impact(k) {
      const s = U.clamp(k, 0.08, 2);
      thump(70 + 90 * Math.min(s, 1), 20, 0.55 + s * 0.35, Math.min(1, 0.5 + s * 0.55));
      thump(150 + 120 * Math.min(s, 1), 28, 0.3, Math.min(0.9, 0.3 + s * 0.4));
      noise({ f: 180 + 900 * Math.min(s, 1.4), f2: 60, dur: 0.45 + s * 0.35, vol: Math.min(0.55, 0.2 + s * 0.3) });
      noise({ f: 3000, f2: 400, dur: 0.16, vol: Math.min(0.4, 0.12 + s * 0.22), type: 'bandpass', q: 0.8 });
      if (s > 0.7) tone({ f: 120, f2: 44, dur: 0.5, type: 'sawtooth', vol: 0.22, delay: 0.02 });
    },
    /* ---- PERFECT signature ----
       Three moments, one voice, so a perfect run sounds different from launch to landing
       and not just louder at the start. */
    perfectLaunch() {
      tone({ f: 320, f2: 1500, dur: 0.5, type: 'sawtooth', vol: 0.22 });
      tone({ f: 1318, dur: 0.45, type: 'triangle', vol: 0.18, delay: 0.06 });
      tone({ f: 1760, dur: 0.4, type: 'triangle', vol: 0.13, delay: 0.13 });
      noise({ f: 900, f2: 5200, dur: 0.55, vol: 0.22, type: 'bandpass', q: 0.7 });
    },
    /* the top of the arc: one soft, airy note, deliberately quiet — it marks the beat
       without competing with the launch behind it or the fall about to start */
    apex(perfect) {
      tone({ f: perfect ? 1046 : 784, f2: perfect ? 1318 : 880, dur: 0.4, type: 'sine', vol: 0.09 });
      if (perfect) tone({ f: 1568, dur: 0.35, type: 'sine', vol: 0.05, delay: 0.07 });
    },
    /* the moment the descent turns into a fall */
    ignite() {
      thump(120, 46, 0.3, 0.45);
      noise({ f: 400, f2: 3200, dur: 0.4, vol: 0.24, type: 'bandpass', q: 0.6 });
      tone({ f: 200, f2: 900, dur: 0.35, type: 'sawtooth', vol: 0.16 });
    },
    /* Rising whistle all the way down. Same overlapping-grain trick as wind(): short
       retriggered notes, so there is no held node to leak across a state change. */
    whistle(fall) {
      if (!ready() || fall < 0.3) return;
      const now = ac.currentTime;
      if (now < (whistleNext || 0)) return;
      whistleNext = now + 0.1;
      const f = 600 + fall * 2200;
      tone({ f, f2: f * 1.18, dur: 0.16, type: 'triangle', vol: 0.05 + fall * 0.07 });
    },
    /* an extra low layer under the normal impact, only for a perfect arrival */
    perfectImpact(k) {
      const s = U.clamp(k, 0.2, 2);
      thump(52, 18, 0.9, Math.min(1, 0.55 + s * 0.4));
      noise({ f: 120, f2: 40, dur: 0.8, vol: 0.3 });
      tone({ f: 90, f2: 30, dur: 0.7, type: 'sawtooth', vol: 0.2, delay: 0.05 });
    },
    /* soil tearing past while the impact carries the drill down */
    crunch(k) {
      const s = U.clamp(k, 0.1, 1.4);
      thump(85, 30, 0.16, 0.22 + s * 0.25);
      noise({ f: 500 + 700 * s, f2: 120, dur: 0.16 + s * 0.1, vol: 0.12 + s * 0.2 });
    },
    /* the drill finally stops: one heavy settle, no ring */
    settleThud() {
      thump(105, 26, 0.4, 0.6);
      noise({ f: 300, f2: 70, dur: 0.3, vol: 0.22 });
    },
    /* Wind on the way down. Retriggered in short overlapping grains rather than held as a
       loop, so it needs no node bookkeeping and cannot survive a state change. */
    wind(fall, alt) {
      if (!ready()) return;
      const now = ac.currentTime;
      if (now < (windNext || 0)) return;
      windNext = now + 0.085;
      const f = 300 + fall * 2600;
      noise({ f, f2: f * 0.7, dur: 0.13, vol: 0.035 + fall * 0.1, type: 'bandpass', q: 0.6 });
    },
    nearMiss() {
      tone({ f: 620, f2: 430, dur: 0.28, type: 'triangle', vol: 0.24 });
      tone({ f: 310, f2: 240, dur: 0.34, type: 'sine', vol: 0.16, delay: 0.06 });
    },
    /* rises as the record gets closer */
    chase(k) {
      tone({ f: 500 + 420 * U.clamp(k, 0, 1), dur: 0.07, type: 'square', vol: 0.07 + 0.06 * k });
    },
    newBest() {
      [660, 880, 1174].forEach((f, i) =>
        tone({ f, dur: 0.34, type: 'triangle', vol: 0.24, delay: i * 0.075 }));
      thump(150, 45, 0.4, 0.6);
    },
    /* Short ascending interval when a new atmosphere is crossed. Higher stages move the
       same two-note identity down and darker, so progression is audible without becoming
       another reward fanfare. */
    stage(index) {
      const base = Math.max(180, 540 - index * 42);
      tone({ f: base, f2: base * 1.18, dur: 0.24, type: 'triangle', vol: 0.13 });
      tone({ f: base * 1.5, f2: base * 1.85, dur: 0.34, type: 'sine', vol: 0.11, delay: 0.08 });
      noise({ f: 900 + index * 180, f2: 260, dur: 0.3, vol: 0.055, type: 'bandpass', q: 0.7 });
    },
    rock() { thump(90, 34, 0.13, 0.3); noise({ f: 520, f2: 120, dur: 0.14, vol: 0.24 }); },
    buy() {
      tone({ f: 420, dur: 0.1, type: 'square', vol: 0.2 });
      tone({ f: 640, dur: 0.14, type: 'square', vol: 0.2, delay: 0.07 });
      tone({ f: 880, dur: 0.2, type: 'triangle', vol: 0.2, delay: 0.14 });
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ f, dur: 0.32, type: 'triangle', vol: 0.2, delay: i * 0.07 }));
    },
    motorKick() {
      thump(165, 58, 0.24, 0.52);
      noise({ f: 1100, f2: 320, dur: 0.2, vol: 0.16, type: 'bandpass', q: 1.1 });
      tone({ f: 210, f2: 420, dur: 0.2, type: 'sawtooth', vol: 0.13 });
    },
    startDrill() {
      if (!ready() || drillNodes) return;
      const src = ac.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 620; flt.Q.value = 3.2;
      const g = ac.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.1, ac.currentTime + 0.3);
      const lfo = ac.createOscillator(); lfo.frequency.value = 26;
      const lfoG = ac.createGain(); lfoG.gain.value = 210;
      lfo.connect(lfoG); lfoG.connect(flt.frequency);
      src.connect(flt); flt.connect(g); g.connect(master);
      src.start(); lfo.start();
      drillNodes = { src, g, lfo };
    },
    stopDrill: API_stopDrill,
  };

  function API_stopDrill() {
    if (!drillNodes || !ac) return;
    const { src, g, lfo } = drillNodes;
    drillNodes = null;
    try {
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(g.gain.value || 0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
      src.stop(ac.currentTime + 0.2); lfo.stop(ac.currentTime + 0.2);
    } catch (e) { /* already stopped */ }
  }
})();
