'use strict';
/* ============ persistence ============ */

const KEY = 'drillorbit.save.v1';

const Save = {
  data: null,
  DEF: { coins: 0, power: 1, bounce: 1, drill: 1, storage: 1, best: 0, deepest: 0, runs: 0, muted: false, found: [] },

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    this.data = Object.assign({}, this.DEF, d || {});
    /* clone: DEF.found is a shared array, so assigning it by reference let discoveries
       leak into the defaults and survive a reset */
    this.data.found = Array.isArray(this.data.found) ? this.data.found.slice() : [];
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  },
  reset() { this.data = Object.assign({}, this.DEF, { found: [] }); this.save(); },
};

/* ============ upgrades ============ */

const COSTS = [50, 100, 175, 300, 500, 800, 1200, 1800, 2600, 3600, 4800, 6200, 8000];
function upgradeCost(level) {
  if (level - 1 < COSTS.length) return COSTS[level - 1];
  return Math.round((COSTS[COSTS.length - 1] * Math.pow(1.42, level - COSTS.length)) / 50) * 50;
}

const UPGRADES = [
  { key: 'power',   name: 'POWER',   c1: '#ff9f45', c2: '#ff5f6d', desc: () => 'Launch Power +10%' },
  { key: 'bounce',  name: 'BOUNCE',  c1: '#7ee8fa', c2: '#3a7bd5', desc: () => 'Bounce +8%' },
  { key: 'drill',   name: 'DRILL',   c1: '#ffe259', c2: '#ffa751', desc: () => 'Max Depth +' + CFG.DEPTH_PER + 'm' },
  { key: 'storage', name: 'STORAGE', c1: '#a8ff78', c2: '#3ec46d', desc: () => 'Carry +1 Mineral' },
];

/* ============ DOM ============ */

const UI = {
  el: {},
  onBuy: null,
  onLaunchAgain: null,

  init() {
    const id = (s) => document.getElementById(s);
    this.el = {
      coinText: id('coinText'), statLabel: id('statLabel'), statValue: id('statValue'),
      storagePill: id('storagePill'), storageText: id('storageText'), coinPill: id('coinPill'),
      subStat: id('subStat'), subLabel: id('subLabel'), subValue: id('subValue'),
      chase: id('chase'), chaseVal: id('chaseVal'),
      nextTarget: id('nextTarget'), nextName: id('nextName'), nextDist: id('nextDist'),
      strip: id('strip'),
      tapHint: id('tapHint'), steerHint: id('steerHint'),
      screen: id('resultScreen'), title: id('resultTitle'),
      rDist: id('rDist'), rDepth: id('rDepth'), rMin: id('rMin'),
      rCoins: id('rCoins'), rBreak: id('rBreak'), rHaul: id('rHaul'),
      upgrades: id('upgradeBar'), launchAgain: id('launchAgain'),
      adBtn: id('adBtn'), adOverlay: id('adOverlay'), adCount: id('adCount'),
      debug: id('debug'), dbgToggle: id('dbgToggle'),
    };

    /* upgrade buttons */
    for (const u of UPGRADES) {
      const b = document.createElement('button');
      b.className = 'up-btn';
      b.dataset.key = u.key;
      b.style.setProperty('--c1', u.c1);
      b.style.setProperty('--c2', u.c2);
      b.title = u.desc();
      b.innerHTML =
        `<div class="n">${u.name}</div>` +
        `<div class="lv"></div>` +
        `<div class="c"><span class="coin"></span><span class="v"></span></div>` +
        `<div class="glowbar"></div>`;
      b.addEventListener('click', () => this.onBuy && this.onBuy(u.key, b));
      this.el.upgrades.appendChild(b);
    }

    this.el.launchAgain.addEventListener('click', () => this.onLaunchAgain && this.onLaunchAgain());
    this.el.adBtn.addEventListener('click', () => this.onAd && this.onAd());
    this.initDebug();
  },

  setPhase(phase) {
    const drilling = phase === 'drill';
    this.el.storagePill.classList.toggle('hidden', !drilling);
    this.el.statLabel.textContent = drilling ? 'DEPTH' : 'DISTANCE';
  },

  /* the bar owns the bottom of the screen, so the canvas meter has to sit above it */
  showUpgradeBar(on) {
    this.el.upgrades.classList.toggle('hidden', !on);
    const h = on ? this.el.upgrades.offsetHeight : 0;
    document.documentElement.style.setProperty('--bar-h', h + 'px');
    Game.bottomUI = h;
  },

  setCoins(v) { this.el.coinText.textContent = Math.round(v); },
  popCoins() {
    this.el.coinPill.classList.remove('pop');
    void this.el.coinPill.offsetWidth;
    this.el.coinPill.classList.add('pop');
    setTimeout(() => this.el.coinPill.classList.remove('pop'), 130);
  },

  setStat(v) {
    const s = Math.round(v);
    if (this._last !== s) {
      this._last = s;
      this.el.statValue.innerHTML = s + '<span class="unit">m</span>';
    }
  },
  punchStat() {
    this.el.statValue.classList.add('punch');
    setTimeout(() => this.el.statValue.classList.remove('punch'), 110);
  },

  setStorage(n, max) {
    this.el.storageText.textContent = n + '/' + max;
    this.el.storagePill.classList.toggle('full', n >= max);
  },

  setSub(label, value) {
    if (!label) { this.el.subStat.classList.add('hidden'); return; }
    this.el.subStat.classList.remove('hidden');
    this.el.subLabel.textContent = label;
    this.el.subValue.textContent = value;
  },

  /* live countdown to the personal record */
  setChase(gap) {
    const e = this.el.chase;
    /* the chase replaces the static BEST line — they share the same slot */
    if (gap == null) {
      e.classList.add('hidden');
      e.classList.remove('hot');
      if (this._subWasShown) this.el.subStat.classList.remove('hidden');
      return;
    }
    this._subWasShown = !this.el.subStat.classList.contains('hidden');
    this.el.subStat.classList.add('hidden');
    e.classList.remove('hidden');
    e.classList.toggle('hot', gap <= 12);
    this.el.chaseVal.textContent = gap + 'm';
  },

  /* the next thing worth aiming at */
  setNext(site, gap) {
    const e = this.el.nextTarget;
    if (!site) { e.classList.add('hidden'); return; }
    e.classList.remove('hidden');
    const mystery = !World.isFound(site);
    e.classList.toggle('mystery', mystery);
    e.classList.toggle('close', gap <= 15);
    this.el.nextName.textContent = World.siteLabel(site);
    this.el.nextDist.textContent = Math.max(0, Math.round(gap)) + 'm';
  },

  /* a compact tease of what lies ahead — no map screen, just a horizon */
  buildStrip(fromM) {
    const e = this.el.strip;
    const ahead = SITES.filter((s) => s.kind !== 'decor' && s.m > fromM).slice(0, 3);
    let html = '<div class="node you">●<em>YOU</em></div>';
    for (const s of ahead) {
      const found = World.isFound(s);
      const cls = s.kind === 'major' ? 'major' : found ? 'found' : 'unknown';
      const glyph = s.kind === 'major' ? '▣' : found ? '◆' : '?';
      html += '<div class="link"></div>';
      html += `<div class="node ${cls}">${glyph}<em>${found ? s.name.split(' ')[0] : '???'}<br>${Math.round(s.m)}m</em></div>`;
    }
    e.innerHTML = html;
  },
  showStrip(on) { this.el.strip.classList.toggle('hidden', !on); },

  showHint(which) {
    this.el.tapHint.classList.toggle('hidden', which !== 'tap');
    if (which === 'steer') {
      this.el.steerHint.classList.remove('hidden');
      this.el.steerHint.style.animation = 'none';
      void this.el.steerHint.offsetWidth;
      this.el.steerHint.style.animation = '';
    } else {
      this.el.steerHint.classList.add('hidden');
    }
  },

  /* ---------- result sheet ---------- */
  showResult(r) {
    const e = this.el;
    e.title.textContent = r.site ? r.site.name + ' RUN' : (r.reason || 'RUN COMPLETE');
    e.title.classList.toggle('mine', !!r.site);
    e.rDist.textContent = Math.round(r.dist) + 'm';
    e.rDepth.textContent = Math.round(r.depth) + 'm';
    e.rMin.textContent = r.count;
    e.rCoins.textContent = '+' + r.coins + ' COINS';
    e.rBreak.textContent = r.siteCoins
      ? `minerals ${r.mineralCoins - r.siteCoins}  +  distance ${r.distCoins}  +  ${World.siteLabel(r.site)} ${r.siteCoins}`
      : `minerals ${r.mineralCoins}  +  distance ${r.distCoins}`;

    e.rHaul.innerHTML = '';
    const tally = {};
    for (const k of r.haul) tally[k] = (tally[k] || 0) + 1;
    let i = 0;
    for (const k in tally) {
      const d = MINERALS[k];
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.style.animationDelay = (0.35 + i * 0.05) + 's';
      chip.innerHTML = `<span class="dot" style="background:${d.color}"></span>${d.name}${tally[k] > 1 ? ' ×' + tally[k] : ''}`;
      e.rHaul.appendChild(chip);
      i++;
    }

    e.adBtn.classList.remove('used');
    e.adBtn.querySelector('.ad-copy b').textContent = 'WATCH AD';
    e.adBtn.querySelector('.ad-copy i').textContent = 'double your coins';
    e.adBtn.querySelector('.ad-mult').textContent = '×' + CFG.AD_MULT;
    this._shownCoins = r.coins;

    this.refreshUpgrades();
    e.screen.classList.remove('hidden');
    /* the toggle floats above the sheet and would sit on the ad button */
    e.dbgToggle.classList.add('hidden');
    e.debug.classList.add('hidden');
  },

  hideResult() {
    this.el.screen.classList.add('hidden');
    this.el.dbgToggle.classList.remove('hidden');
  },

  /* fake rewarded video: same shape as the real thing, no network, no SDK */
  playAd(onReward) {
    const e = this.el;
    let n = 3;
    e.adCount.textContent = n;
    e.adOverlay.classList.remove('hidden');
    const tick = setInterval(() => {
      n--;
      e.adCount.textContent = n > 0 ? n : '✓';
      if (n <= 0) {
        clearInterval(tick);
        setTimeout(() => {
          e.adOverlay.classList.add('hidden');
          onReward();
        }, 420);
      }
    }, 1000);
  },

  markAdUsed(total) {
    const e = this.el;
    e.adBtn.classList.add('used');
    e.adBtn.querySelector('.ad-copy b').textContent = 'REWARD CLAIMED';
    e.adBtn.querySelector('.ad-copy i').textContent = 'once per run';
    this.countCoinsTo(total);
  },

  /* count the EARNED figure up so the doubling is something you watch happen */
  countCoinsTo(target) {
    const el = this.el.rCoins;
    const from = this._shownCoins || 0;
    const t0 = performance.now();
    const dur = 700;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const v = Math.round(U.lerp(from, target, U.easeOutCubic(k)));
      el.textContent = '+' + v + ' COINS';
      if (k < 1) requestAnimationFrame(tick);
      else { this._shownCoins = target; el.style.transform = ''; }
    };
    el.style.transform = 'scale(1.14)';
    requestAnimationFrame(tick);
  },

  refreshUpgrades() {
    const d = Save.data;
    for (const b of this.el.upgrades.children) {
      const k = b.dataset.key;
      const lv = d[k];
      const cost = upgradeCost(lv);
      b.querySelector('.lv').textContent = 'Lv ' + lv;
      b.querySelector('.v').textContent = cost;
      b.classList.toggle('afford', d.coins >= cost);
    }
    this.syncDebug();
  },

  flashBought(btn) {
    btn.classList.remove('bought');
    void btn.offsetWidth;
    btn.classList.add('bought');
  },

  /* ---------- debug ---------- */
  initDebug() {
    const id = (s) => document.getElementById(s);
    const dbg = this.el.debug;
    this.el.dbgToggle.addEventListener('click', () => dbg.classList.toggle('hidden'));

    const bind = (elId, field) => {
      const el = id(elId);
      el.addEventListener('change', () => {
        const v = Math.max(field === 'coins' ? 0 : 1, Math.floor(+el.value || 0));
        Save.data[field] = v;
        Save.save();
        this.refreshUpgrades();
        Game.syncFromSave();
      });
      return el;
    };
    this.dbgInputs = {
      best: bind('dBest', 'best'),
      coins: bind('dCoins', 'coins'),
      power: bind('dPower', 'power'),
      bounce: bind('dBounce', 'bounce'),
      drill: bind('dDrill', 'drill'),
      storage: bind('dStorage', 'storage'),
    };

    id('dAddCoins').addEventListener('click', () => {
      Save.data.coins += 1000; Save.save(); this.refreshUpgrades(); Game.syncFromSave();
    });
    id('dMaxPower').addEventListener('click', () => {
      Save.data.power = 20; Save.data.bounce = 12; Save.data.drill = 14; Save.data.storage = 12;
      Save.save(); this.refreshUpgrades(); Game.syncFromSave();
    });
    const perfectBtn = id('dPerfect');
    perfectBtn.addEventListener('click', () => {
      Game.autoPerfect = !Game.autoPerfect;
      perfectBtn.classList.toggle('on', Game.autoPerfect);
      perfectBtn.innerHTML = 'Auto&nbsp;Perfect: ' + (Game.autoPerfect ? 'ON' : 'OFF');
    });
    const muteBtn = id('dMute');
    const syncMute = () => {
      muteBtn.textContent = 'Sound: ' + (Save.data.muted ? 'OFF' : 'ON');
      muteBtn.classList.toggle('on', !Save.data.muted);
      SFX.setMuted(Save.data.muted);
    };
    muteBtn.addEventListener('click', () => { Save.data.muted = !Save.data.muted; Save.save(); syncMute(); });
    this._syncMute = syncMute;

    const zonesBtn = id('dZones');
    zonesBtn.addEventListener('click', () => {
      Game.showZones = !Game.showZones;
      zonesBtn.classList.toggle('on', Game.showZones);
      zonesBtn.textContent = 'Zones: ' + (Game.showZones ? 'ON' : 'OFF');
    });
    id('dRestart').addEventListener('click', () => { this.hideResult(); Game.resetToPad(); });
    id('dFound').addEventListener('click', () => {
      Save.data.found = SITES.filter((s) => s.kind === 'mystery').map((s) => s.id);
      Save.save();
      Game.resetToPad();
    });

    id('dReset').addEventListener('click', () => {
      Save.reset(); this.refreshUpgrades(); Game.syncFromSave(); Game.resetToPad();
    });
  },

  syncDebug() {
    if (!this.dbgInputs) return;
    for (const k in this.dbgInputs) this.dbgInputs[k].value = Save.data[k];
    if (this._syncMute) this._syncMute();
  },
};
