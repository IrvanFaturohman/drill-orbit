'use strict';
/* ============ procedural WebAudio SFX (no assets) ============ */

const SFX = (function () {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;
  let drillNodes = null;

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
    bounce(strength) {
      const s = U.clamp(strength, 0.15, 1);
      thump(110 + 90 * s, 34, 0.16 + s * 0.12, 0.3 + s * 0.5);
      noise({ f: 900 * s + 200, f2: 140, dur: 0.16, vol: 0.28 * s + 0.05 });
      tone({ f: 150 + 220 * s, f2: 60, dur: 0.14, type: 'triangle', vol: 0.2 * s });
    },
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
