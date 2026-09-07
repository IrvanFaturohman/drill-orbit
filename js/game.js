'use strict';
/* ============ Drill Orbit — main loop ============ */

const Game = {
  /* --- runtime --- */
  W: 0, H: 0,
  state: 'ready',            // ready | flying | settle | dive | drill | ending | result
  t: 0, timeScale: 1, slowT: 0, freezeT: 0,
  autoPerfect: false,
  showZones: false,
  started: false,

  cam: { x: 0, y: 0, zoom: 1, tzoom: 1, anchor: 0.55, shake: 0, shakeT: 0, sx: 0, sy: 0 },
  bottomUI: 0,
  flash: 0, flashColor: '255,255,255',
  banner: null,

  meterT: 0.5, meterDir: 1, meterSpeed: 1.15,

  run: null,
  input: { down: false, x: 0, side: 0, keyL: false, keyR: false },

  /* ================= boot ================= */
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Save.load();
    UI.init();
    UI.onBuy = (k, btn) => this.buy(k, btn);
    UI.onLaunchAgain = () => { UI.hideResult(); this.resetToPad(); };
    UI.onAd = () => this.watchAd();

    World.init(1337);
    this.pod = new Pod();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindInput();

    this.syncFromSave();
    UI.refreshUpgrades();
    this.resetToPad(true);

    this.last = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  },

  resize() {
    const app = document.getElementById('app');
    const r = app.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width));
    this.H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.S = this.H / 800;   // UI scale factor
  },

  bindInput() {
    const c = document.getElementById('app');
    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return p.clientX - r.left;
    };
    const isUI = (e) => e.target.closest('#resultScreen, #upgradeBar, #adOverlay, #debug, #dbgToggle');

    const down = (e) => {
      if (isUI(e)) return;
      SFX.init();
      e.preventDefault();
      this.input.down = true;
      this.input.x = pos(e);
      this.input.side = this.input.x < this.W / 2 ? -1 : 1;
      if (this.state === 'ready') this.doLaunch();
    };
    const move = (e) => {
      if (!this.input.down || isUI(e)) return;
      this.input.x = pos(e);
      this.input.side = this.input.x < this.W / 2 ? -1 : 1;
    };
    const up = () => { this.input.down = false; this.input.side = 0; };

    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      SFX.init();
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.input.keyL = true;
      if (k === 'd' || k === 'arrowright') this.input.keyR = true;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        if (this.state === 'ready') this.doLaunch();
        else if (this.state === 'result') { UI.hideResult(); this.resetToPad(); }
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.input.keyL = false;
      if (k === 'd' || k === 'arrowright') this.input.keyR = false;
    });
  },

  /* ================= stats from save ================= */
  syncFromSave() {
    const d = Save.data;
    this.powerMult = 1 + CFG.POWER_PER * (d.power - 1);
    this.storageMax = CFG.STORAGE_BASE + CFG.STORAGE_PER * (d.storage - 1);
    this.baseDepth = CFG.DEPTH_BASE + CFG.DEPTH_PER * (d.drill - 1);
    UI.setCoins(d.coins);
  },
  restitution() {
    return Math.min(CFG.BOUNCE_MAX, CFG.BOUNCE_BASE * Math.pow(1 + CFG.BOUNCE_PER, Save.data.bounce - 1));
  },

  /* ================= run lifecycle ================= */
  resetToPad(first) {
    this.syncFromSave();
    this.state = 'ready';
    World.ug = null;
    FX.reset();
    SFX.stopDrill();
    this.pod.reset(CFG.PAD_X, World.yAt(CFG.PAD_X) - this.pod.r);
    this.pod.drilling = false;
    this.pod.angle = -0.35;
    this.run = {
      dist: 0, maxDist: 0, depth: 0, haul: [], count: 0,
      mine: false, rating: '', mult: 1, fullT: 0, reason: '',
      chain: 0, chainT: 0, mineralCoins: 0, bestChain: 0,
      perfect: false, site: null, siteCoins: 0, bonusDepth: 0, rareMult: 1,
      nearMiss: null, chaseAnnounced: 0, nextSite: null,
    };
    this.cam.x = CFG.PAD_X + 90;
    this.cam.y = World.yAt(CFG.PAD_X) - 90;
    this.cam.zoom = this.cam.tzoom = 1;
    this.cam.anchor = 0.55;
    this.meterT = 0.5; this.meterDir = 1;
    this.banner = null;
    this._dived = false;
    this.overdrive = 0;
    this.pod.overdrive = false;
    this.odBounceDone = false;
    this.timeScale = 1; this.slowT = 0; this.freezeT = 0;
    UI.setPhase('ready');
    UI.setStat(0);
    UI.setStorage(0, this.storageMax);
    UI.showHint('tap');
    UI.showUpgradeBar(true);
    UI.setChase(null);
    UI.buildStrip(0);
    UI.showStrip(true);
    const firstSite = World.nextSite(0);
    if (firstSite) UI.setNext(firstSite, firstSite.m - firstSite.half);
    UI.setSub(Save.data.best > 0 ? 'BEST' : '', Math.round(Save.data.best) + 'm');
    if (!first) UI.punchStat();
  },

  /* tap -> squash for 110ms -> fire. Anticipation is what makes the release land. */
  doLaunch() {
    const acc = this.autoPerfect ? 1 : 1 - Math.abs(this.meterT - 0.5) * 2;
    const perfect = acc >= CFG.PERFECT_ACC;
    /* SO CLOSE is presentation only — it launches exactly like the GREAT it is. */
    const soClose = !perfect && acc >= CFG.SOCLOSE_ACC;

    let rating, color, sub = '';
    if (perfect) { rating = 'PERFECT!'; color = '#7dffb0'; sub = 'OVERDRIVE'; }
    else if (soClose) { rating = 'SO CLOSE!'; color = '#ffd85e'; sub = 'ALMOST PERFECT'; }
    else if (acc >= 0.72) { rating = 'GREAT!'; color = '#9fe6ff'; }
    else if (acc >= 0.42) { rating = 'GOOD!'; color = '#ffe27d'; }
    else { rating = 'WEAK'; color = '#ff9d9d'; }

    let mult = 0.5 + 0.45 * Math.pow(acc, 0.85);
    if (perfect) mult = 1.15;

    this.run.rating = perfect ? 'PERFECT!' : soClose ? 'GREAT!' : rating;
    this.run.mult = mult;
    this.run.perfect = perfect;
    this.pending = { v: CFG.BASE_V * this.powerMult * mult, rating, color, sub, perfect, soClose, mult, acc };
    this.state = 'charge';
    this.chargeT = 0;
    this.chargeDur = 0.11;
    UI.showHint('');
    UI.showUpgradeBar(false);
    UI.showStrip(false);
    SFX.charge();
  },

  updCharge(dt) {
    this.chargeT += dt;
    const k = U.clamp(this.chargeT / this.chargeDur, 0, 1);
    this.pod.charge = U.easeInCubic(k) * 0.62;
    this.pod.tickSquash(dt);
    this.pod.y = World.yAt(this.pod.x) - this.pod.r - 6 + k * 5;
    this.cam.tzoom = 1.14;
    /* energy gathering into the pod */
    if (Math.random() < 0.8) {
      const a = Math.random() * U.TAU, r = U.rand(50, 95);
      FX.add({
        x: this.pod.x + Math.cos(a) * r, y: this.pod.y + Math.sin(a) * r * 0.6,
        vx: -Math.cos(a) * r * 5, vy: -Math.sin(a) * r * 3,
        r: U.rand(2, 4), life: 0.14, color: '#9ff2ff', g: 0, drag: 0, glow: true, shrink: true,
      });
    }
    if (k >= 1) this.fireLaunch();
  },

  fireLaunch() {
    const { v, rating, color, sub, perfect, soClose, mult, acc } = this.pending;
    this.pod.charge = 0;
    this.pod.launch(v, CFG.ANGLE);
    this.state = 'flying';

    /* PERFECT is not a one-second banner — it turns the drill into a meteor */
    this.overdrive = perfect ? CFG.OVERDRIVE_T : 0;
    this.odBounceDone = false;
    this.pod.overdrive = perfect;

    /* --- juice --- */
    this.hitstop(perfect ? 0.085 : soClose ? 0.055 : 0.05);
    this.shake(perfect ? 26 : 10 + mult * 9, perfect ? 0.5 : 0.32);
    this.setBanner(rating, sub, color, perfect ? 1.6 : soClose ? 1.1 : 0.9, perfect ? 1.35 : soClose ? 1.12 : 1);
    if (perfect) { this.flash = 1; this.flashColor = '160,255,200'; }
    else if (soClose) { this.flash = 0.32; this.flashColor = '255,215,110'; SFX.soClose(); }

    const px = this.pod.x, py = this.pod.y + 10;
    const pal = World.paletteAt(px / CFG.M);
    FX.dust(px - 14, py + 6, perfect ? 26 : 16, U.shade(pal.top2, 0.25), 1 + mult);
    FX.burst(px, py, {
      n: perfect ? 30 : 16, dir: -CFG.ANGLE + Math.PI, spread: 1.6,
      spd0: 160, spd1: 620, r0: 2, r1: 6, life0: 0.25, life1: 0.6,
      color: ['#fff3b0', '#ffb03a', '#ff6a2a'], glow: true, g: 300, shrink: true,
    });
    FX.ring(px, py, { r0: 8, r1: perfect ? 210 : 130, w: 8, color: perfect ? 'rgba(160,255,200,.9)' : 'rgba(255,255,255,.65)', life: 0.5 });
    if (perfect) FX.ring(px, py, { r0: 8, r1: 300, w: 4, color: 'rgba(255,255,255,.55)', life: 0.75 });
    SFX.launch(acc);
  },

  endFlight() {
    this.state = 'settle';
    this.settleT = 0;
    this.settleDur = 0.6;
    this.overdrive = 0;
    this.pod.overdrive = false;
    this.pod.trail.length = 0;
    UI.setChase(null);
    UI.setNext(null);
    this.hitstop(0.06);
    this.shake(12, 0.34);
    SFX.thud();
    FX.dust(this.pod.x, this.pod.y + 14, 22, '#d8c9a8', 1.5);
    FX.ring(this.pod.x, this.pod.y + 12, { r0: 6, r1: 110, w: 5, color: 'rgba(255,255,255,.5)', life: 0.4 });

    const xm = World.mOf(this.pod.x);
    const site = World.siteAt(xm);
    this.run.mine = World.inMine(this.pod.x);
    this.run.site = site;

    if (site) this.claimSite(site);
    else {
      const miss = World.nearMiss(xm);
      if (miss) this.showNearMiss(miss);
      else this.setBanner(Math.round(this.run.maxDist) + 'm', this.run.rating, '#9fe6ff', 1.0, 1.05);
    }
  },

  /* landed inside a reward zone */
  claimSite(site) {
    const r = site.reward || {};
    const first = !World.isFound(site);
    if (site.kind === 'mystery' && first) {
      Save.data.found = Save.data.found || [];
      Save.data.found.push(site.id);
      Save.save();
    }

    let sub = '';
    if (r.coins) { this.run.siteCoins += r.coins; sub = '+' + r.coins + ' COINS'; }
    if (r.depth) { this.run.bonusDepth += r.depth; sub = '+' + r.depth + 'm DEPTH'; }
    if (r.rare) { this.run.rareMult = Math.max(this.run.rareMult, r.rare); sub = 'RARE MINERAL CHANCE UP'; }
    if (r.depthMult) sub = '+50% DEPTH  ·  RARE MINERALS';

    const title = first && site.kind === 'mystery' ? 'DISCOVERED!' : site.name + '!';
    if (first && site.kind === 'mystery') sub = site.name;

    this.setBanner(title, sub, site.kind === 'mystery' ? '#d8aaff' : '#9ff2ff', 1.8, 1.25);
    this.settleDur = 1.0;
    this.flash = 0.65; this.flashColor = site.kind === 'mystery' ? '200,150,255' : '150,240,255';
    this.shake(16, 0.5);
    this.hitstop(0.07);
    SFX.fanfare();
    FX.ring(this.pod.x, this.pod.y, { r0: 10, r1: 280, w: 7, color: 'rgba(140,240,255,.9)', life: 0.8 });
    FX.burst(this.pod.x, this.pod.y, {
      n: 38, spd0: 80, spd1: 430, r0: 2, r1: 6, life0: 0.5, life1: 1.2,
      color: ['#9ff2ff', '#ffffff', '#7ec8ff'], glow: true, g: 120,
    });
  },

  /* stopped just outside one — show the gap and hold the camera on both */
  showNearMiss(miss) {
    const gap = Math.max(1, Math.round(miss.gap));
    this.run.nearMiss = miss;
    this.settleDur = 1.0;
    this.setBanner(
      gap + 'm ' + (miss.short ? 'SHORT!' : 'TOO FAR!'),
      World.siteLabel(miss.site),
      miss.short ? '#ffd85e' : '#ffb38a', 1.7, 1.2
    );
    SFX.nearMiss();
    FX.text(
      World.xOf(miss.site.m), World.yAt(World.xOf(miss.site.m)) - 130,
      miss.short ? 'SO CLOSE' : 'JUST PAST IT',
      { color: '#ffd85e', size: 18, life: 1.2 }
    );
  },

  /* keep the NEXT readout pointed at the closest thing still ahead */
  updateNext(d) {
    const site = World.nextSite(d);
    if (!site) { UI.setNext(null); return; }
    if (site !== this.run.nextSite) {
      this.run.nextSite = site;
      UI.buildStrip(d);
    }
    UI.setNext(site, (site.m - site.half) - d);
  },

  /* live countdown to the record */
  updateChase(d) {
    const best = Save.data.best;
    if (!best || this.run.beatBest) return;
    const gap = best - d;
    if (gap > 0 && gap <= CFG.BEST_CHASE_M) {
      UI.setChase(Math.ceil(gap));
      const step = Math.ceil(gap / 5);
      if (step !== this.run.chaseAnnounced) {
        this.run.chaseAnnounced = step;
        SFX.chase(1 - gap / CFG.BEST_CHASE_M);
      }
    } else UI.setChase(null);
  },

  prepDrill() {
    const d = Save.data;
    const maxDepth = this.baseDepth * (this.run.mine ? CFG.MINE_DEPTH_MULT : 1) + this.run.bonusDepth;
    const rare = Math.max(this.run.rareMult, this.run.mine ? CFG.MINE_RARE_BOOST : 1);
    World.genUnderground(this.pod.x, maxDepth, rare, (Math.random() * 1e9) | 0);
    this.run.maxDepth = maxDepth;
    this.pod.drilling = true;
    this.pod.vx = 0; this.pod.vy = 10;
    UI.setPhase('drill');
    UI.setNext(null);
    UI.setChase(null);
    UI.setStat(0);
    UI.setStorage(0, this.storageMax);
    UI.setSub('MAX DEPTH', Math.round(maxDepth) + 'm');
    if (d.runs < 2) UI.showHint('steer');
    SFX.startDrill();
  },

  endRun(reason) {
    if (this.state === 'result') return;
    this.state = 'result';
    SFX.stopDrill();
    UI.showHint('');
    UI.setSub('');

    const r = this.run;
    const mineralCoins = r.mineralCoins + r.siteCoins;
    const distCoins = Math.round(CFG.DIST_COIN * Math.sqrt(Math.max(0, r.maxDist)));
    const coins = mineralCoins + distCoins;

    Save.data.coins += coins;
    Save.data.runs++;
    Save.data.best = Math.max(Save.data.best, r.maxDist);
    Save.data.deepest = Math.max(Save.data.deepest, r.depth);
    Save.save();
    UI.setCoins(Save.data.coins);

    this.lastCoins = coins;
    r.adUsed = false;

    UI.showResult({
      dist: r.maxDist, depth: r.depth, count: r.count, haul: r.haul,
      coins, mineralCoins, distCoins, mine: r.mine, reason,
      site: r.site, siteCoins: r.siteCoins,
    });
    SFX.fanfare();
  },

  /* placeholder rewarded ad: no network, no SDK — just the loop shape to play-test */
  watchAd() {
    if (this.run.adUsed) return;
    this.run.adUsed = true;
    UI.playAd(() => {
      const bonus = this.lastCoins * (CFG.AD_MULT - 1);
      Save.data.coins += bonus;
      Save.save();
      UI.setCoins(Save.data.coins);
      UI.popCoins();
      UI.markAdUsed(this.lastCoins * CFG.AD_MULT);
      UI.refreshUpgrades();
      SFX.fanfare();
    });
  },

  buy(key, btn) {
    const d = Save.data;
    const cost = upgradeCost(d[key]);
    if (d.coins < cost) {
      btn.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' },
         { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
        { duration: 180 }
      );
      return;
    }
    d.coins -= cost;
    d[key]++;
    Save.save();
    this.syncFromSave();
    UI.refreshUpgrades();
    UI.flashBought(btn);
    UI.popCoins();
    SFX.buy();
  },

  /* ================= loop ================= */
  loop(ts) {
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    dt = Math.min(dt, 0.05);

    /* hitstop beats slow-mo: a hard freeze reads as impact, slow-mo reads as drama */
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      this.timeScale = 0.02;
    } else if (this.slowT > 0) {
      this.slowT -= dt;
      this.timeScale = U.damp(this.timeScale, 0.28, 12, dt);
    } else {
      this.timeScale = U.damp(this.timeScale, 1, 6, dt);
    }

    const sdt = dt * this.timeScale;
    this.t += sdt;
    this.update(sdt, dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt, rawDt) {
    FX.update(dt);
    this.flash = Math.max(0, this.flash - rawDt * 2.6);
    if (this.banner) {
      this.banner.t += rawDt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }

    switch (this.state) {
      case 'ready': this.updReady(dt); break;
      case 'charge': this.updCharge(dt); break;
      case 'flying': this.updFlying(dt); break;
      case 'settle': this.updSettle(dt); break;
      case 'dive': this.updDive(dt); break;
      case 'drill': this.updDrill(dt); break;
    }

    this.updCamera(dt, rawDt);
  },

  /* ---------- READY ---------- */
  updReady(dt) {
    this.meterT += this.meterDir * this.meterSpeed * dt;
    if (this.meterT > 1) { this.meterT = 1; this.meterDir = -1; }
    if (this.meterT < 0) { this.meterT = 0; this.meterDir = 1; }

    this.pod.charge = 0.06 + Math.sin(this.t * 3) * 0.03;
    this.pod.spin += dt * 3;
    this.pod.tickSquash(dt);
    this.pod.angle = -0.35 + Math.sin(this.t * 1.6) * 0.05;

    const gy = World.yAt(this.pod.x);
    this.pod.y = gy - this.pod.r - 6 - Math.sin(this.t * 2.2) * 2;

    this.cam.x = U.damp(this.cam.x, CFG.PAD_X + 95, 4, dt);
    this.cam.y = U.damp(this.cam.y, gy - 95, 4, dt);
    this.cam.tzoom = 1;
    this.cam.anchor = 0.55;
  },

  /* ---------- FLYING ---------- */
  updFlying(dt) {
    this.pod.charge = 0;
    this.pod.updateFlight(dt, (x, y, impact) => this.onBounce(x, y, impact));

    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (this.overdrive <= 0) {
        this.overdrive = 0;
        this.pod.overdrive = false;
        FX.ring(this.pod.x, this.pod.y, { r0: 10, r1: 90, w: 3, color: 'rgba(255,180,90,.5)', life: 0.4 });
      }
    }

    const d = Math.max(0, (this.pod.x - CFG.PAD_X) / CFG.M);
    this.run.dist = d;
    if (d > this.run.maxDist) {
      this.run.maxDist = d;
      UI.setStat(d);
      this.updateChase(d);
      this.updateNext(d);
      if (Save.data.best > 0 && d > Save.data.best && !this.run.beatBest) {
        this.run.beatBest = true;
        UI.setChase(null);
        this.setBanner('NEW BEST!', '', '#ffd85e', 1.3, 1.15);
        this.flash = 0.5; this.flashColor = '255,220,120';
        this.hitstop(0.05);
        this.shake(14, 0.4);
        SFX.newBest();
        FX.ring(this.pod.x, this.pod.y, { r0: 8, r1: 190, w: 6, color: 'rgba(255,216,94,.85)', life: 0.6 });
      }
    }

    /* speed particles — overdrive throws off sparks and a flame wake */
    const od = this.overdrive > 0;
    if (this.pod.speed > (od ? 300 : 560) && Math.random() < (od ? 1 : 0.85)) {
      const a = Math.atan2(this.pod.vy, this.pod.vx) + Math.PI;
      FX.streak(
        this.pod.x + U.rand(-14, 14), this.pod.y + U.rand(-14, 14),
        Math.cos(a) * this.pod.speed * 0.25, Math.sin(a) * this.pod.speed * 0.25,
        od ? 'rgba(255,210,140,.75)' : 'rgba(180,235,255,.6)'
      );
    }
    if (od) {
      const a = Math.atan2(this.pod.vy, this.pod.vx) + Math.PI;
      FX.flame(this.pod.x + Math.cos(a) * 14, this.pod.y + Math.sin(a) * 14, a, 1.5);
      if (Math.random() < 0.35) {
        FX.add({
          x: this.pod.x + U.rand(-16, 16), y: this.pod.y + U.rand(-16, 16),
          vx: U.rand(-70, 70), vy: U.rand(-90, 20),
          r: U.rand(1.5, 3), life: U.rand(0.2, 0.5), color: '#fff6c0',
          g: 240, drag: 1.2, glow: true, shrink: true,
        });
      }
    }
    /* booster flame right after launch */
    if (this.pod.boost > 0) {
      const a = Math.atan2(this.pod.vy, this.pod.vx) + Math.PI;
      FX.flame(this.pod.x + Math.cos(a) * 16, this.pod.y + Math.sin(a) * 16, a, this.pod.boost * 2);
    }

    if (this.pod.restT > 0.26 || this.pod.x > CFG.WORLD_M * CFG.M - 400) this.endFlight();
  },

  onBounce(x, y, impact) {
    const k = U.clamp(impact / 900, 0.12, 1);

    /* the first real bounce of a PERFECT run is the payoff moment */
    const odHit = this.overdrive > 0 && !this.odBounceDone && k > 0.3;
    if (odHit) {
      this.odBounceDone = true;
      this.overdrive += CFG.OVERDRIVE_BOUNCE;
      this.hitstop(0.11);
      this.shake(30, 0.55);
      this.flash = 0.55; this.flashColor = '255,190,110';
      FX.ring(x, y, { r0: 8, r1: 300, w: 10, color: 'rgba(255,190,90,.9)', life: 0.6 });
      FX.ring(x, y, { r0: 8, r1: 200, w: 5, color: 'rgba(255,255,255,.7)', life: 0.42 });
      FX.dust(x, y, 34, '#e8d5ae', 2.4);
      FX.burst(x, y, {
        n: 40, dir: -Math.PI / 2, spread: 2.6, spd0: 140, spd1: 620,
        r0: 2, r1: 8, life0: 0.3, life1: 0.8,
        color: ['#fff3b0', '#ffb03a', '#ff6a2a', '#ffffff'], glow: true, g: 500, shrink: true,
      });
      FX.text(x, y - 46, 'OVERDRIVE!', { color: '#ffca6a', size: 22, life: 0.9 });
      SFX.overdriveHit();
    } else {
      this.hitstop(0.018 + k * 0.055);
    }
    this.shake(5 + k * 19, 0.16 + k * 0.16);
    const pal = World.paletteAt(x / CFG.M);
    FX.dust(x, y, Math.round(6 + k * 14), U.shade(pal.top2, 0.3), 0.6 + k * 1.2);
    FX.burst(x, y, {
      n: Math.round(4 + k * 10), dir: -Math.PI / 2, spread: 2.2,
      spd0: 60, spd1: 120 + k * 380, r0: 2, r1: 5,
      color: [pal.top, pal.soil, '#ffffff'], g: 900, shape: 'square',
    });
    FX.ring(x, y, { r0: 4, r1: 40 + k * 90, w: 4, color: 'rgba(255,255,255,.5)', life: 0.32 });
    SFX.bounce(k);
    if (this.pod.bounces > 1 && k > 0.35) {
      FX.text(x, y - 28, 'BOUNCE ×' + this.pod.bounces, { color: '#ffffff', size: 15, life: 0.7 });
    }
  },

  /* ---------- SETTLE ---------- */
  updSettle(dt) {
    this.settleT += dt;
    this.pod.tickSquash(dt);
    this.pod.spin += dt * 4;
    if (!this.run.nearMiss) this.cam.tzoom = 1.25;
    this.cam.anchor = 0.55;
    if (this.settleT > (this.settleDur || 0.6)) {
      this.prepDrill();        // generate the field now; the camera dives into it
      this.state = 'dive';
      this.diveT = 0;
      this.diveDur = 0.45;
      this.pod.drilling = true;
    }
  },

  /* ---------- DIVE (surface -> underground) ---------- */
  updDive(dt) {
    this.diveT += dt;
    const k = U.clamp(this.diveT / this.diveDur, 0, 1);

    /* rotate nose down, then sink in */
    this.pod.angle = U.lerp(this.pod.angle, Math.PI / 2, 1 - Math.exp(-7 * dt));
    this.pod.spin += dt * (10 + k * 40);
    const gy = World.yAt(this.pod.x);
    this.pod.y = U.lerp(gy - this.pod.r - 4, gy + 46, U.easeInCubic(k));
    this.pod.tickSquash(dt);

    if (Math.random() < 0.7) {
      const pal = World.paletteAt(this.pod.x / CFG.M);
      FX.dust(this.pod.x + U.rand(-10, 10), gy, 2, U.shade(pal.soil, 0.2), 0.9);
    }
    if (k > 0.35 && !this._dived) {
      this._dived = true;
      this.shake(10, 0.3);
      FX.burst(this.pod.x, gy, {
        n: 18, dir: -Math.PI / 2, spread: 2.4, spd0: 90, spd1: 320,
        r0: 3, r1: 7, color: ['#8a6a44', '#6a4f30', '#a98a5f'], g: 1100, shape: 'square',
      });
    }

    this.cam.tzoom = U.lerp(1.25, 2.4, U.smooth(k));
    this.cam.anchor = U.lerp(0.55, 0.34, U.smooth(k));

    if (k >= 1) {
      this._dived = false;
      this.state = 'drill';
      World.ug.tunnel.push({ x: this.pod.x, y: gy - 10 });
    }
  },

  /* ---------- DRILL ---------- */
  updDrill(dt) {
    const ug = World.ug;
    let steer = 0;
    if (this.input.down) steer = this.input.side;
    if (this.input.keyL) steer -= 1;
    if (this.input.keyR) steer += 1;
    this.pod.steer = U.clamp(steer, -1, 1);

    this.pod.updateDrill(dt, ug, {
      canCollect: () => this.run.count < this.storageMax,
      mineral: (m) => this.onMineral(m),
      rock: (r) => this.onRockBreak(r),
      grind: (r) => this.onGrind(r),
    });

    if (this.run.chainT > 0) {
      this.run.chainT -= dt;
      if (this.run.chainT <= 0) this.run.chain = 0;
    }

    const depth = (this.pod.y - ug.surfaceY) / CFG.M;
    if (depth > this.run.depth) {
      this.run.depth = depth;
      UI.setStat(depth);
    }

    /* drilling dust */
    if (Math.random() < 0.55) {
      FX.add({
        x: this.pod.x + U.rand(-8, 8), y: this.pod.y + 14,
        vx: U.rand(-70, 70), vy: U.rand(-70, -10),
        r: U.rand(2, 5), life: U.rand(0.25, 0.6),
        color: U.pick(['#8a6a44', '#5d4a38', '#a98a5f']),
        g: 260, drag: 1.4, shape: 'square', vr: U.rand(-9, 9),
      });
    }

    /* end conditions */
    if (this.run.count >= this.storageMax) {
      this.run.fullT += dt;
      if (this.run.fullT > 0.85) { this.endRun('STORAGE FULL'); return; }
    }
    if (this.pod.y >= ug.botY) {
      this.pod.y = ug.botY;
      this.shake(14, 0.4);
      FX.burst(this.pod.x, ug.botY, {
        n: 22, dir: -Math.PI / 2, spread: 2.6, spd0: 90, spd1: 340,
        r0: 2, r1: 6, color: ['#ffd23d', '#ffffff', '#8a8aa0'], g: 900, shape: 'square',
      });
      SFX.thud();
      this.endRun('MAX DEPTH');
    }
  },

  onMineral(m) {
    const def = MINERALS[m.type];
    const r = this.run;
    r.haul.push(m.type);
    r.count++;
    UI.setStorage(r.count, this.storageMax);

    /* chain: linking pickups without a gap pays more, so steering is worth doing well */
    r.chain = r.chainT > 0 ? r.chain + 1 : 1;
    r.chainT = 1.15;
    r.bestChain = Math.max(r.bestChain, r.chain);
    const mult = Math.min(3, 1 + (r.chain - 1) * 0.5);
    const gained = Math.round(def.value * mult);
    r.mineralCoins += gained;

    FX.text(m.x, m.y - 12, '+' + gained, { color: def.edge, size: 20 + (mult - 1) * 7, life: 0.85 });
    if (r.chain > 1) {
      FX.text(m.x, m.y - 40, 'CHAIN ×' + mult.toFixed(1).replace('.0', ''), {
        color: '#ffd85e', size: 15 + r.chain, life: 0.7, vy: -30,
      });
    }
    SFX.pick(r.chain - 1);
    FX.ring(m.x, m.y, { r0: 4, r1: def.tier === 2 ? 130 : 52, w: 4, color: U.rgba(def.color, 0.85), life: 0.4 });
    FX.burst(m.x, m.y, {
      n: def.tier === 2 ? 26 : 12, spd0: 60, spd1: def.tier === 2 ? 340 : 180,
      r0: 2, r1: def.tier === 2 ? 6 : 4, life0: 0.3, life1: 0.8,
      color: [def.color, def.edge, '#ffffff'], glow: true, g: 260, shape: 'shard',
    });

    if (def.tier === 2) {
      this.hitstop(0.1);
      this.slowT = 0.45;
      this.flash = 0.9; this.flashColor = '255,255,255';
      this.shake(18, 0.5);
      this.setBanner('RARE FIND!', def.name, def.edge, 1.5, 1.2);
      SFX.rare();
    } else {
      this.hitstop(def.tier === 1 ? 0.035 : 0.02);
      this.shake(def.tier === 1 ? 8 : 4, 0.14);
    }

    if (this.run.count >= this.storageMax) {
      this.setBanner('STORAGE FULL!', 'RETURNING TO SURFACE', '#ff9d9d', 1.3, 1);
      this.shake(10, 0.3);
    }
  },

  onGrind(r) {
    if (Math.random() < 0.7) {
      FX.burst(this.pod.x, this.pod.y + 12, {
        n: 2, dir: -Math.PI / 2, spread: 2.4, spd0: 80, spd1: 240,
        r0: 1.5, r1: 3.5, color: ['#fff2b0', '#ffd06a'], glow: true, g: 500, life0: 0.15, life1: 0.35,
      });
    }
  },

  onRockBreak(r) {
    this.shake(7, 0.2);
    SFX.rock();
    FX.burst(r.x, r.y, {
      n: 14, spd0: 60, spd1: 260, r0: 3, r1: 7, life0: 0.3, life1: 0.7,
      color: ['#7d7a86', '#4a4753', '#9a97a4'], g: 900, shape: 'shard',
    });
  },

  /* freeze frames on impact — the single biggest juice lever */
  hitstop(d) { this.freezeT = Math.max(this.freezeT, d); },

  /* ---------- camera ---------- */
  shake(mag, dur) {
    this.cam.shake = Math.max(this.cam.shake, mag);
    this.cam.shakeT = Math.max(this.cam.shakeT, dur);
    this.cam.shakeDur = this.cam.shakeT;
  },

  updCamera(dt, rawDt) {
    const c = this.cam, p = this.pod;

    if (this.state === 'flying') {
      const gy = World.yAt(p.x);
      const od = this.overdrive > 0 ? 1 : 0;
      /* overdrive reads as speed: more lead, more pull-back, snappier follow */
      const lead = U.clamp(p.vx * (0.12 + od * 0.06), 0, 220 + od * 90);
      c.x = U.damp(c.x, p.x + lead, 6 + od * 1.6, dt);
      c.y = U.damp(c.y, p.y * 0.62 + (gy - 150) * 0.38, 4.5, dt);
      const alt = Math.max(0, gy - p.y);
      c.tzoom = U.clamp(1.08 - p.speed / 3600 - alt / 2600 - od * 0.09, 0.38, 1.1);
      c.anchor = 0.55;
    } else if (this.state === 'settle') {
      /* on a near miss, pull back far enough that the pod AND the zone it missed
         are both on screen — the whole point is seeing how close it was */
      const miss = this.run.nearMiss;
      if (miss) {
        const tx = World.xOf(miss.site.m);
        const mid = (p.x + tx) / 2;
        const spanPx = Math.abs(tx - p.x) + 260;
        c.x = U.damp(c.x, mid, 4, dt);
        c.y = U.damp(c.y, Math.min(p.y, World.yAt(tx)) - 70, 4, dt);
        c.tzoom = U.damp(c.tzoom, U.clamp(this.W / spanPx, 0.5, 1.25), 4, dt);
      } else {
        c.x = U.damp(c.x, p.x, 5, dt);
        c.y = U.damp(c.y, p.y - 40, 5, dt);
      }
    } else if (this.state === 'dive' || this.state === 'drill') {
      c.x = U.damp(c.x, p.x, 5, dt);
      c.y = U.damp(c.y, p.y + 40, 4.5, dt);
      if (this.state === 'drill') { c.tzoom = 2.4; c.anchor = 0.34; }
    } else if (this.state === 'result') {
      c.y = U.damp(c.y, p.y + 40, 3, dt);
    }

    c.zoom = U.damp(c.zoom, c.tzoom, 3.2, dt);

    if (c.shakeT > 0) {
      c.shakeT -= rawDt;
      const k = U.clamp(c.shakeT / (c.shakeDur || 1), 0, 1);
      const m = c.shake * k * k;
      c.sx = U.rand(-m, m);
      c.sy = U.rand(-m, m);
      if (c.shakeT <= 0) { c.shake = 0; c.sx = c.sy = 0; }
    } else { c.sx = U.damp(c.sx, 0, 12, rawDt); c.sy = U.damp(c.sy, 0, 12, rawDt); }
  },

  setBanner(text, sub, color, life, scale) {
    this.banner = { text, sub: sub || '', color, life: life || 1, t: 0, scale: scale || 1 };
  },

  /* ================= draw ================= */
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H, c = this.cam;
    ctx.clearRect(0, 0, W, H);

    World.drawSky(ctx, c, W, H);
    const underground = (this.state === 'drill' || this.state === 'result' || this.state === 'dive') && World.ug;
    if (!underground || c.y < World.ug.surfaceY + 40) World.drawParallax(ctx, c, W, H);

    /* world transform */
    ctx.save();
    ctx.translate(W / 2, H * c.anchor);
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-(c.x + c.sx), -(c.y + c.sy));

    const left = c.x - (W / 2) / c.zoom - 40;
    const right = c.x + (W / 2) / c.zoom + 40;
    const top = c.y - (H * c.anchor) / c.zoom - 40;
    const bottom = c.y + (H * (1 - c.anchor)) / c.zoom + 40;

    World.drawTerrain(ctx, c, left, right);
    if (underground) World.drawUnderground(ctx, c, left, right, top, bottom);

    this.drawPad(ctx);
    this.drawBestFlag(ctx, left, right);
    if (this.showZones) this.drawZoneDebug(ctx, left, right);

    this.pod.drawTrail(ctx);
    FX.draw(ctx, c.zoom);
    this.pod.draw(ctx);

    ctx.restore();

    /* screen space overlays */
    if (this.state === 'ready' || this.state === 'charge') this.drawMeter(ctx, W, H);
    this.drawBanner(ctx, W, H);
    this.drawVignette(ctx, W, H);
    if (this.flash > 0.001) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.75})`;
      ctx.fillRect(0, 0, W, H);
    }
  },

  drawPad(ctx) {
    /* the pod's art is shifted back along its axis (NOSE_PIVOT), so seat the pad under
       where it actually renders, not under its collision point. 0.94 = cos(rest angle). */
    const x = CFG.PAD_X - this.pod.r * NOSE_PIVOT * 0.94, y = World.yAt(CFG.PAD_X);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 42, 8, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#4b5878';
    U.rr(ctx, x - 38, y - 12, 76, 14, 5); ctx.fill();
    ctx.fillStyle = '#66779c';
    U.rr(ctx, x - 38, y - 14, 76, 5, 3); ctx.fill();
    ctx.fillStyle = '#2f3a52';
    U.rr(ctx, x - 30, y - 2, 10, 12, 3); ctx.fill();
    U.rr(ctx, x + 20, y - 2, 10, 12, 3); ctx.fill();
    /* stripes */
    ctx.save();
    U.rr(ctx, x - 38, y - 14, 76, 6, 3); ctx.clip();
    for (let i = -4; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffd23d' : '#2b3550';
      ctx.beginPath();
      ctx.moveTo(x - 40 + i * 11, y - 14);
      ctx.lineTo(x - 34 + i * 11, y - 14);
      ctx.lineTo(x - 40 + i * 11, y - 8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },

  /* debug: exact landing windows and near-miss margins */
  drawZoneDebug(ctx, left, right) {
    ctx.save();
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    for (const s of SITES) {
      if (s.half <= 0) continue;
      const a = World.xOf(s.m - s.half), b = World.xOf(s.m + s.half);
      if (b < left - 200 || a > right + 200) continue;
      const na = World.xOf(s.m - s.half - s.near), nb = World.xOf(s.m + s.half + s.near);
      const y = World.yAt(World.xOf(s.m));
      ctx.fillStyle = 'rgba(255,216,94,.16)';
      ctx.fillRect(na, y - 200, nb - na, 200);
      ctx.fillStyle = 'rgba(90,255,150,.28)';
      ctx.fillRect(a, y - 200, b - a, 200);
      ctx.fillStyle = '#fff';
      ctx.fillText(`${s.id} ${s.m}±${s.half} (near ${s.near})`, World.xOf(s.m), y - 206);
    }
    ctx.restore();
  },

  drawBestFlag(ctx, left, right) {
    const b = Save.data.best;
    if (b <= 5) return;
    const x = CFG.PAD_X + b * CFG.M;
    if (x < left - 60 || x > right + 60) return;
    const y = World.yAt(x);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 52); ctx.stroke();
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(x, y - 52); ctx.lineTo(x + 30, y - 44); ctx.lineTo(x, y - 34);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('BEST ' + Math.round(b) + 'm', x, y - 58);
  },

  /* ---------- timing meter ---------- */
  drawMeter(ctx, W, H) {
    const S = this.S;
    const w = W * 0.82, h = 30 * S;
    const x = (W - w) / 2, y = H - (this.bottomUI || 0) - 74 * S;

    ctx.save();
    /* frame */
    ctx.fillStyle = 'rgba(6,12,24,.55)';
    U.rr(ctx, x - 7, y - 7, w + 14, h + 14, (h + 14) / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
    U.rr(ctx, x - 7, y - 7, w + 14, h + 14, (h + 14) / 2); ctx.stroke();

    /* zones: RED | YELLOW | GREEN | PERFECT | GREEN | YELLOW | RED.
       The PERFECT band is the real threshold drawn to scale, so a miss is legible. */
    const pw = (1 - CFG.PERFECT_ACC) / 2;          // half-width of PERFECT, as a fraction
    const p0 = 0.5 - pw, p1 = 0.5 + pw;
    ctx.save();
    U.rr(ctx, x, y, w, h, h / 2); ctx.clip();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const stops = [
      [0.00, '#e0374f'], [0.14, '#e0374f'], [0.16, '#f5b53c'], [0.28, '#f5b53c'],
      [0.30, '#3fd97a'], [p0 - 0.005, '#5ce89a'],
      [p0, '#ffffff'], [0.50, '#f2ffd0'], [p1, '#ffffff'],
      [p1 + 0.005, '#5ce89a'], [0.70, '#3fd97a'],
      [0.72, '#f5b53c'], [0.84, '#f5b53c'], [0.86, '#e0374f'], [1.00, '#e0374f'],
    ];
    for (const [pp, col] of stops) g.addColorStop(U.clamp(pp, 0, 1), col);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    /* animated pulse inside the PERFECT window only */
    const pulse = 0.22 + Math.sin(this.t * 6) * 0.16;
    ctx.fillStyle = `rgba(210,255,140,${pulse})`;
    ctx.fillRect(x + w * p0, y, w * (p1 - p0), h);

    /* gloss */
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x, y, w, h * 0.38);
    ctx.restore();

    /* hard border around the true PERFECT window */
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + w * p0, y - 3, w * (p1 - p0), h + 6);

    /* label + arrows pointing at it */
    const cx = x + w * 0.5;
    ctx.fillStyle = `rgba(230,255,170,${0.75 + Math.sin(this.t * 6) * 0.25})`;
    ctx.font = `bold ${10 * S}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('PERFECT', cx, y - 26 * S);
    for (const sx of [-1, 1]) {
      const ax = cx + sx * (w * (p1 - p0) / 2 + 13 * S + Math.sin(this.t * 4) * 2);
      ctx.beginPath();
      ctx.moveTo(ax + sx * -6 * S, y - 8 * S);
      ctx.lineTo(ax + sx * -13 * S, y - 15 * S);
      ctx.lineTo(ax + sx * -13 * S, y - 1 * S);
      ctx.closePath();
      ctx.fill();
    }

    /* marker */
    const mx = x + w * this.meterT;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#fff';
    U.rr(ctx, mx - 3.5 * S, y - 10 * S, 7 * S, h + 20 * S, 3.5 * S); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(mx, y - 12 * S);
    ctx.lineTo(mx - 8 * S, y - 24 * S);
    ctx.lineTo(mx + 8 * S, y - 24 * S);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `bold ${11 * S}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('STOP IN THE GREEN', W / 2, y + h + 16 * S);
    ctx.restore();
  },

  /* ---------- banner ---------- */
  drawBanner(ctx, W, H) {
    const b = this.banner;
    if (!b) return;
    const k = b.t / b.life;
    const inK = U.clamp(b.t / 0.28, 0, 1);
    const pop = U.easeOutBack(inK);
    const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const S = this.S;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H * 0.33 - k * 26 * S);
    ctx.scale(pop * b.scale, pop * b.scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    ctx.font = `bold ${44 * S}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10 * S;
    ctx.strokeStyle = 'rgba(8,14,26,.75)';
    ctx.strokeText(b.text, 0, 0);
    const g = ctx.createLinearGradient(0, -26 * S, 0, 26 * S);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    ctx.fillText(b.text, 0, 0);

    if (b.sub) {
      ctx.font = `bold ${15 * S}px ${FONT}`;
      ctx.lineWidth = 6 * S;
      ctx.strokeText(b.sub, 0, 34 * S);
      ctx.fillStyle = b.color;
      ctx.fillText(b.sub, 0, 34 * S);
    }
    ctx.restore();
  },

  drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },
};

window.addEventListener('load', () => Game.init());
