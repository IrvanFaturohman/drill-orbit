'use strict';
/* ============ Drill Orbit — main loop ============ */

const Game = {
  /* --- runtime --- */
  W: 0, H: 0,
  state: 'ready',            // ready | charge | flying | penetrate | drill | result
  t: 0, timeScale: 1, slowT: 0, freezeT: 0,
  autoPerfect: false,
  showZones: false,
  started: false,
  /* ---------- mechanical energy ----------
     Deliberately simple and deliberately NOT inflated by height: KE and PE trade places
     through the arc and the total only moves through launch quality and upgrades. The
     high trajectory buys anticipation and a steep arrival, never extra energy.
     Units are px/s and px; everything downstream uses ratios, so they never need to be
     real joules. Shown to the player only as a bar, and to me only in debug. */
  kinetic(p) { return 0.5 * CFG.POD_MASS * (p.vx * p.vx + p.vy * p.vy); },
  potential(p) {
    const h = Math.max(0, (World.yAt(p.x) - p.r) - p.y);   // height above local ground
    return CFG.POD_MASS * CFG.GRAV * h;
  },
  mechanical(p) { return this.kinetic(p) + this.potential(p); },
  /* IMPACT upgrade: how much of the arriving kinetic energy becomes penetration budget.
     SAVE COMPATIBILITY: the level still lives in Save.data.bounce. The stat was called
     BOUNCE back when terrain bouncing was the core loop; that loop is gone, but renaming
     the save key would strand every existing save's upgrade level, so the key stays and
     only the label changed. See UPGRADES in js/ui.js. */
  impactEfficiency() {
    return CFG.IMPACT_EFF_BASE + CFG.IMPACT_EFF_PER * (Save.data.bounce - 1);
  },
  /* normalised penetration budget a contact at this speed would buy */
  impactBudget(speed) {
    const ke = 0.5 * CFG.POD_MASS * speed * speed;
    return (ke / CFG.IMPACT_ENERGY_SCALE) * this.impactEfficiency();
  },
  /* integrate the drain so depth is known before the first frame of penetration —
     the underground field has to be generated deep enough to contain it */
  predictDepth(energy, resist) {
    let e = energy, d = 0;
    const step = 0.25;
    while (e > 0 && d < 600) {
      e -= CFG.SOIL_RESISTANCE * resist * (1 + d * CFG.SOIL_HARDEN_PER_M) * step;
      d += step;
    }
    return d;
  },

  cam: { x: 0, y: 0, zoom: 1, tzoom: 1, anchor: 0.55, shake: 0, shakeT: 0, sx: 0, sy: 0,
         kickX: 0, kickY: 0, kickT: 0, kickDur: 0,
         /* bz: the zoom the BACKGROUND is drawn at. Since the sky and the parallax started
            scaling with the camera, a hard cut to c.zoom yanks the whole planet across the
            screen in one frame — onImpact snaps zoom from 0.28 to 0.95 to stop the
            underground field being revealed all at once, and that snap measured +114px of
            horizon and -0.25 of the space factor in a single frame. Distant things should
            answer a camera move slowly; that is what parallax IS. So the background gets
            its own damped zoom and simply catches up. */
         bz: 1 },
  bottomUI: 0,
  flash: 0, flashColor: '255,255,255',
  banner: null,
  stageBanner: null, stageWash: 0,
  impactBurst: null,

  meterT: 0.5, meterDir: 1, meterSpeed: 1.15,

  run: null,
  /* Steering state for the underground phase. `steer` is the live -1..1 deflection and
     `dragX` is the moving origin it is measured from; see setSteer in bindInput. The
     surface phase reads no input at all past the launch tap — timing is the whole of the
     surface skill. */
  input: { down: false, x: 0, dragX: 0, steer: 0, keyL: false, keyR: false, spaceDown: false },

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
    /* fall back to home if the saved pad was never actually unlocked */
    this.padKey = World.padUnlocked(Save.data.pad, Save.data.pads) ? Save.data.pad : 'greenline';
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

    /* Deflection from how far the finger has travelled sideways since it went down.
       The origin CHASES the finger, staying at most one full range behind it, so a long
       drag never pins the stick against its own limit: however far the thumb has wandered,
       turning the other way is the same short movement. Without that the player has to
       drag all the way back across the screen before the drill even starts to answer. */
    const setSteer = (x) => {
      const i = this.input;
      const R = CFG.DRILL_STEER_RANGE, D = CFG.DRILL_STEER_DEAD;
      i.dragX = U.clamp(i.dragX, x - R, x + R);
      const d = x - i.dragX;
      const mag = U.clamp((Math.abs(d) - D) / (R - D), 0, 1);
      i.steer = d < 0 ? -mag : mag;
    };

    const down = (e) => {
      if (isUI(e)) return;
      SFX.init();
      e.preventDefault();
      /* capture so a drag that wanders off the canvas keeps steering instead of freezing
         the drill mid-turn — the single most annoying thing a touch control can do */
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* mouse in some browsers */ }
      this.input.down = true;
      this.input.x = pos(e);
      this.input.dragX = this.input.x;      // touching down is never a turn
      this.input.steer = 0;
      if (this.state === 'ready') this.doLaunch('pointer');
    };
    const move = (e) => {
      if (!this.input.down || isUI(e)) return;
      this.input.x = pos(e);
      setSteer(this.input.x);
    };
    /* pointerup AND pointercancel land here, so a cancelled touch can never leave the
       drill steering stuck on */
    const up = () => {
      this.input.down = false; this.input.steer = 0;
    };

    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      SFX.init();
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.input.keyL = true;
      if (k === 'd' || k === 'arrowright') this.input.keyR = true;
      if (k === ' ' || k === 'enter') {
        e.preventDefault();
        this.input.spaceDown = true;
        if (this.state === 'ready') this.doLaunch('key');
        else if (this.state === 'result') { UI.hideResult(); this.resetToPad(); }
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') this.input.keyL = false;
      if (k === 'd' || k === 'arrowright') this.input.keyR = false;
      if (k === ' ' || k === 'enter') this.input.spaceDown = false;
    });
  },

  /* ================= launch pad =================
     CFG.PAD_X is the ORIGIN of the metres-travelled coordinate and never moves; this is
     where THIS run starts. Splitting the two is what lets the pad travel without
     invalidating the authored site table or the layout tools. */
  padKey: 'greenline',
  get padX() { return World.padX(this.padKey); },

  /* Pick a pad. Refuses anything the player has not actually reached, so a stale save or a
     hand-edited list cannot drop the pod somewhere it has no business being. */
  selectPad(key) {
    if (!World.padUnlocked(key, Save.data.pads)) return false;
    if (key === this.padKey) return false;
    this.padKey = key;
    Save.data.pad = key;
    Save.save();
    if (this.state === 'ready') this.resetToPad();
    UI.buildPadBar(this.padKey);
    return true;
  },

  /* Reaching a stage for the first time is what unlocks its pad. Checked against ABSOLUTE
     world position, not this run's distance, because that is what "I have been here" means. */
  checkPadUnlock(absM) {
    for (const pad of World.pads) {
      if (pad.m === 0 || pad.m > absM) continue;
      if (Save.data.pads.includes(pad.key)) continue;
      Save.data.pads.push(pad.key);
      Save.save();
      const atm = World.stageAt(World.xOf(pad.m) / CFG.M);
      this.setBanner('PAD UNLOCKED', atm.name, atm.accent, 1.6, 1.2);
      this.flash = Math.max(this.flash, 0.3);
      this.flashColor = '255,220,150';
      FX.ring(this.pod.x, this.pod.y, {
        r0: 10, r1: 240, w: 6, color: U.rgba(U.hex(atm.accent), 0.8), life: 0.7,
      });
      SFX.newBest();
      UI.buildPadBar(this.padKey);
    }
  },

  /* ================= stats from save ================= */
  syncFromSave() {
    const d = Save.data;
    this.powerMult = 1 + CFG.POWER_PER * (d.power - 1);
    this.baseDepth = CFG.DEPTH_BASE + CFG.DEPTH_PER * (d.drill - 1);
    UI.setCoins(d.coins);
  },
  /* ================= run lifecycle ================= */
  resetToPad(first) {
    this.syncFromSave();
    this.state = 'ready';
    World.ug = null;
    /* The scars are a drawing, and they belong to one run. Keeping them would mean the
       picture showing damage that collision no longer knows about, which is the exact
       disagreement this model exists to make impossible. */
    World.clearCraters();
    FX.reset();
    SFX.stopDrill();
    const px = this.padX;
    this.pod.reset(px, World.yAt(px) - this.pod.r);
    this.pod.drilling = false;
    this.pod.angle = -0.35;
    this.run = {
      dist: 0, maxDist: 0, depth: 0, haul: [], count: 0,
      mine: false, rating: '', mult: 1, reason: '',
      chain: 0, chainT: 0, mineralCoins: 0, bestChain: 0,
      perfect: false, site: null, siteCoins: 0, bonusDepth: 0, rareMult: 1,
      nearMiss: null, chaseAnnounced: 0, nextSite: null,
      /* the surface arc and the impact it buys */
      impactSpeed: 0, impactEnergy: 0, impactDepth: 0, impactDepthTarget: 0,
      impactDepthFinal: 0, manualDepth: 0, impactHaul: 0, lastBand: -1, launchME: 0,
      fall: 0, ignited: false, apexDone: false, apexT: 0,
      /* Seeded with the PAD's stage, not the world's first one: starting at SUNSCORCHED
         would otherwise fire a stage banner on frame one for a stage you never crossed. */
      stageKey: World.stageAt(px / CFG.M).key,
      stageIndex: World.stageAt(px / CFG.M).index,
      absM: World.mOf(px), maxAbsM: World.mOf(px),
    };
    this.cam.x = px + 90;
    this.cam.y = World.yAt(px) - 90;
    this.cam.zoom = this.cam.tzoom = this.cam.bz = 1;
    this.cam.anchor = 0.55;
    this.meterT = 0.5; this.meterDir = 1;
    this.banner = null;
    this.stageBanner = null;
    this.stageWash = 0;
    this.impactBurst = null;
    this.ugReveal = 0;
    this.overdrive = 0;
    this.pod.overdrive = false;
    this.timeScale = 1; this.slowT = 0; this.freezeT = 0;
    UI.setPhase('ready');
    UI.setStat(0);
    UI.setHaul(0);
    UI.showHint('tap');
    UI.showUpgradeBar(true);
    UI.setChase(null);
    const fromM = World.mOf(px);
    UI.buildStrip(fromM);
    UI.showStrip(true);
    UI.buildPadBar(this.padKey);
    const firstSite = World.nextSite(fromM);
    if (firstSite) UI.setNext(firstSite, (firstSite.m - firstSite.half) - fromM);
    UI.setSub(Save.data.best > 0 ? 'BEST' : '', Math.round(Save.data.best) + 'm');
    UI.setEnergy(null);
    this.penStopT = 0;
    if (!first) UI.punchStat();
  },

  /* tap -> squash for 110ms -> fire. Anticipation is what makes the release land.
     `src` is which input launched: that one stays disarmed for diving until released. */
  doLaunch(src) {
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
    this.pending = { v: CFG.IMPACT_BASE_V * this.powerMult * mult, rating, color, sub, perfect, soClose, mult, acc };
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
    this.pod.launch(v, CFG.IMPACT_ANGLE);
    this.state = 'flying';
    this.run.launchME = this.mechanical(this.pod);

    /* PERFECT is not a one-second banner — it turns the drill into a meteor */
    this.overdrive = perfect ? CFG.OVERDRIVE_T : 0;
    this.pod.overdrive = perfect;

    /* --- juice ---
       PERFECT gets a visibly different EVENT, not a bigger version of the same one:
       a double shockwave, a full white flash, a longer freeze, and a launch thrown along
       the barrel rather than an undirected rumble. */
    this.hitstop(perfect ? 0.09 : soClose ? 0.055 : 0.05);
    const la = -CFG.IMPACT_ANGLE;
    this.shake(perfect ? 22 : 10 + mult * 9, perfect ? 0.55 : 0.32,
               perfect ? -Math.cos(la) : undefined, perfect ? -Math.sin(la) : undefined);
    this.setBanner(rating, sub, color, perfect ? 1.6 : soClose ? 1.1 : 0.9, perfect ? 1.35 : soClose ? 1.12 : 1);
    if (perfect) { this.flash = 0.72; this.flashColor = '190,255,215'; }
    else if (soClose) { this.flash = 0.32; this.flashColor = '255,215,110'; SFX.soClose(); }

    const px = this.pod.x, py = this.pod.y + 10;
    const pal = World.paletteAt(px / CFG.M);
    FX.dust(px - 14, py + 6, perfect ? 26 : 16, U.shade(pal.top2, 0.25), 1 + mult);
    FX.burst(px, py, {
      n: perfect ? 30 : 16, dir: -CFG.IMPACT_ANGLE + Math.PI, spread: 1.6,
      spd0: 160, spd1: 620, r0: 2, r1: 6, life0: 0.25, life1: 0.6,
      color: ['#fff3b0', '#ffb03a', '#ff6a2a'], glow: true, g: 300, shrink: true,
    });
    FX.ring(px, py, { r0: 8, r1: perfect ? 210 : 130, w: 8, color: perfect ? 'rgba(160,255,200,.9)' : 'rgba(255,255,255,.65)', life: 0.5 });
    if (perfect) {
      FX.ring(px, py, { r0: 8, r1: 300, w: 4, color: 'rgba(255,255,255,.55)', life: 0.75 });
      /* a second, slower wave — one ring reads as an effect, two read as a detonation */
      FX.ring(px, py, { r0: 20, r1: 430, w: 9, color: 'rgba(255,200,110,.6)', life: 1.05 });
      FX.burst(px, py, {
        n: 22, dir: -CFG.IMPACT_ANGLE + Math.PI, spread: 0.9,
        spd0: 420, spd1: 980, r0: 2, r1: 5, life0: 0.3, life1: 0.7,
        color: ['#fff6d0', '#ffca6a'], glow: true, g: 260, shrink: true,
      });
      /* deliberately NO slow-mo here. Slow-mo is for savouring something you are watching
         land; a launch is something you want to feel accelerate away from you. */
    }
    SFX.launch(acc);
    if (perfect) SFX.perfectLaunch();
    Haptics.launch(perfect);
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

  /* Atmosphere is a progression reward in its own right. It follows raw world metres,
     not biome mechanics, and gets a dedicated lower-key banner so it never steals the
     impact banner's slot. */
  updateAtmosphereStage(xm) {
    const stage = World.stageAt(xm);
    if (stage.key === this.run.stageKey) return;
    this.run.stageKey = stage.key;
    this.run.stageIndex = stage.index;
    this.stageBanner = { ...stage, t: 0, life: 2.15 };
    this.stageWash = 1;
    this.shake(3.5 + stage.index * 0.45, 0.2, -1, 0);
    FX.ring(this.pod.x, this.pod.y, {
      r0: 12, r1: 150 + stage.index * 18, w: 4,
      color: U.rgba(U.hex(stage.accent), 0.65), life: 0.65,
    });
    FX.burst(this.pod.x, this.pod.y, {
      n: 10 + stage.index * 2, dir: Math.PI, spread: 1.0,
      spd0: 90, spd1: 320, r0: 1.2, r1: 3.4, life0: 0.28, life1: 0.62,
      color: [stage.accent, '#ffffff'], glow: true, g: 0, drag: 1.5, shape: 'shard',
    });
    SFX.stage(stage.index);
    Haptics.tick(0.25 + stage.index * 0.08);
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
    /* Separate from BEST on purpose: BEST is the best single launch, `reach` is the
       furthest point in the world ever touched. Only the second one gates anything. */
    Save.data.reach = Math.max(Save.data.reach || 0, r.maxAbsM || 0);
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
    /* Clamped at BOTH ends. The upper bound keeps a stalled tab from teleporting the pod
       through terrain; the lower bound matters just as much, because every smoothed value
       in the game goes through U.damp, and damp with a negative dt computes a negative
       blend factor — it extrapolates AWAY from the target instead of approaching it. One
       backwards timestamp (a backgrounded phone tab, a clock adjustment) was enough to
       throw the camera hundreds of pixels off the pod and leave the screen blank. */
    dt = U.clamp(dt, 0, 0.05);

    /* hitstop beats slow-mo: a hard freeze reads as impact, slow-mo reads as drama */
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      this.timeScale = 0.02;
    } else if (this.slowT > 0) {
      this.slowT -= dt;
      this.timeScale = U.damp(this.timeScale, 0.28, 12, dt);
    } else {
      /* Snap back, do not wind back up. At lambda 6 the game took ~500ms to return to
         full speed after ANY hitstop, so every launch crawled off the pad in slow motion
         and then gradually accelerated — the exact opposite of what a launch should feel
         like. A hitstop is freeze-then-GO; the ramp only exists to avoid a visible step. */
      this.timeScale = U.damp(this.timeScale, 1, 22, dt);
    }

    const sdt = dt * this.timeScale;
    this.t += sdt;
    this.update(sdt, dt);
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt, rawDt) {
    FX.update(dt);
    /* decay faster the brighter it is, so a big flash is a POP rather than a wash */
    this.flash = Math.max(0, this.flash - rawDt * (2.6 + this.flash * 3.4));
    if (this.banner) {
      this.banner.t += rawDt;
      if (this.banner.t > this.banner.life) this.banner = null;
    }
    this.stageWash = Math.max(0, this.stageWash - rawDt * 1.45);
    if (this.stageBanner) {
      this.stageBanner.t += rawDt;
      if (this.stageBanner.t > this.stageBanner.life) this.stageBanner = null;
    }
    if (this.impactBurst) {
      this.impactBurst.t += rawDt * 0.72;
      if (this.impactBurst.t > this.impactBurst.life) this.impactBurst = null;
    }
    /* game time, not raw, so the hitstop freezes the reveal along with everything else —
       the contact freeze-frame holds the surface exactly as it was */
    if (this.ugReveal < 1) this.ugReveal = Math.min(1, this.ugReveal + dt / CFG.UG_REVEAL_T);

    switch (this.state) {
      case 'ready': this.updReady(dt); break;
      case 'charge': this.updCharge(dt); break;
      case 'flying': this.updFlying(dt); break;
      case 'penetrate': this.updPenetrate(dt); break;
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

    this.cam.x = U.damp(this.cam.x, this.padX + 95, 4, dt);
    this.cam.y = U.damp(this.cam.y, gy - 95, 4, dt);
    this.cam.tzoom = 1;
    this.cam.anchor = 0.55;
  },

  /* ---------- FLYING ----------
     One arc, no air control, no pads, no terrain bouncing. The launch decides everything
     and the fall is pure anticipation: the whole surface phase exists to deliver ONE
     impact, and every beat below is about making the speed coming back readable before
     it arrives. Ends the moment the ground is touched, in Pod.updateFlight -> onImpact. */
  updFlying(dt) {
    const p = this.pod;
    p.charge = 0;

    p.updateFlight(dt, (x, y, spd, ang) => this.onImpact(x, y, spd, ang));
    if (this.state !== 'flying') return;         // the impact took over mid-frame

    /* Two distances, and they are not the same thing.
       `d` is travelled FROM THIS PAD: it is what the launch actually achieved, what the
       payout is a square root of, and what BEST compares against — a record that stays
       comparable no matter which pad it was set from.
       `abs` is the absolute position in the world: it is what sites, atmospheres, the NEXT
       readout and the pad unlocks are keyed to. Paying out on `abs` would hand a player
       714 coins for launching from ANOMALY and doing nothing. */
    const d = Math.max(0, (p.x - this.padX) / CFG.M);
    const abs = World.mOf(p.x);
    this.run.dist = d;
    this.run.absM = abs;
    this.updateAtmosphereStage(p.x / CFG.M);
    if (abs > this.run.maxAbsM) {
      this.run.maxAbsM = abs;
      this.updateNext(abs);
      this.checkPadUnlock(abs);
    }
    if (d > this.run.maxDist) {
      this.run.maxDist = d;
      UI.setStat(d);
      this.updateChase(d);
      if (Save.data.best > 0 && d > Save.data.best && !this.run.beatBest) {
        this.run.beatBest = true;
        UI.setChase(null);
        this.setBanner('NEW BEST!', '', '#ffd85e', 1.3, 1.15);
        this.flash = 0.5; this.flashColor = '255,220,120';
        this.hitstop(0.05);
        this.shake(14, 0.4);
        SFX.newBest();
        FX.ring(p.x, p.y, { r0: 8, r1: 190, w: 6, color: 'rgba(255,216,94,.85)', life: 0.6 });
      }
    }

    /* ---- the fall is the anticipation, so it has to build ----
       Everything here keys off DOWNWARD speed, not total speed: the climb should feel
       weightless and the descent should feel like something is about to break. */
    const alt = Math.max(0, (World.yAt(p.x) - p.r) - p.y);
    /* energy bar: what the launch bought, spent as the arc plays out. Total mechanical
       energy barely moves, so the bar is steady — it reads as "this is my hit". */
    UI.setEnergy(this.mechanical(p) / Math.max(1, this.run.launchME));
    const fall = U.clamp(p.vy / 1400, 0, 1);          // 0 climbing, 1 screaming down
    this.run.fall = fall;
    const meteor = this.run.perfect;

    /* ---- APEX HANG ----
       The top of the arc is the one moment the drill is weightless, and it is the beat
       that separates "going up" from "coming down". A parabola already lingers there,
       but not enough to read as a held breath.
       Done with slow-motion rather than by bending gravity ON PURPOSE: timeScale scales
       dt for the whole simulation uniformly, so the trajectory in game-time — and
       therefore the impact speed and the entire energy model — is bit-for-bit unchanged.
       Weakening gravity near the top would have altered every tuned depth number. */
    if (!this.run.apexDone && p.vy >= 0 && !p.grounded && this.run.launchME > 0) {
      this.run.apexDone = true;
      this.slowT = meteor ? 0.2 : 0.13;
      this.run.apexT = 0.55;                 // camera pulls back while this runs down
      SFX.apex(meteor);
      if (meteor) {
        FX.ring(p.x, p.y, { r0: 6, r1: 120, w: 3, color: 'rgba(255,225,170,.5)', life: 0.6 });
      }
    }
    if (this.run.apexT > 0) this.run.apexT -= dt;

    /* ---- PERFECT is a burning meteor, for the whole descent ----
       The launch banner lasts a second; the flight lasts two. If PERFECT only changes
       the banner then by the time the payoff arrives there is nothing left saying this
       run was special. So the fire IS the flight, and it gets hotter as it falls. */
    if (meteor) {
      const a = Math.atan2(p.vy, p.vx) + Math.PI;
      const heat = 0.55 + fall * 1.25;
      FX.flame(p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15, a, heat);
      if (Math.random() < 0.4 + fall * 0.5) {
        FX.add({
          x: p.x + U.rand(-13, 13), y: p.y + U.rand(-13, 13),
          vx: Math.cos(a) * U.rand(40, 200) - p.vx * 0.05, vy: Math.sin(a) * U.rand(40, 200) - p.vy * 0.05,
          r: U.rand(1.5, 3.4), life: U.rand(0.25, 0.7), color: U.pick(['#fff3b0', '#ffb03a', '#ff6a2a']),
          g: 120, drag: 1.1, glow: true, shrink: true,
        });
      }
      /* IGNITION: one beat, the moment the fall turns serious. Only PERFECT gets it,
         and it is the cue that the impact coming is the big one. */
      if (!this.run.ignited && fall > 0.4) {
        this.run.ignited = true;
        this.flash = 0.3; this.flashColor = '255,190,110';
        this.hitstop(0.03);
        FX.ring(p.x, p.y, { r0: 10, r1: 210, w: 6, color: 'rgba(255,190,90,.8)', life: 0.5 });
        FX.burst(p.x, p.y, {
          n: 20, dir: Math.atan2(p.vy, p.vx) + Math.PI, spread: 1.8,
          spd0: 120, spd1: 460, r0: 2, r1: 5, life0: 0.25, life1: 0.6,
          color: ['#fff3b0', '#ffb03a', '#ff6a2a'], glow: true, g: 200, shrink: true,
        });
        FX.text(p.x, p.y - 44, 'BURNING UP!', { color: '#ffca6a', size: 20, life: 0.8 });
        SFX.ignite();
        Haptics.tick(1);
      }
      SFX.whistle(fall);
    }

    if (fall > 0.12) {
      const a = Math.atan2(p.vy, p.vx) + Math.PI;
      const n = 1 + Math.round(fall * 3);
      for (let i = 0; i < n; i++) {
        FX.streak(
          p.x + U.rand(-16, 16), p.y + U.rand(-18, 18),
          Math.cos(a) * p.speed * (0.2 + fall * 0.25), Math.sin(a) * p.speed * (0.2 + fall * 0.25),
          this.overdrive > 0 ? 'rgba(255,205,130,.8)' : `rgba(200,235,255,${0.35 + fall * 0.45})`
        );
      }
      /* a rising tremble in the last stretch before contact, never enough to blur */
      if (fall > 0.45 && alt < 460) this.shake(fall * 2 * (1 - alt / 460), 0.07);
      SFX.wind(fall, alt);
    }

    /* Guard rail, not a gameplay path: the world is 4200m and a maxed chain measures
       ~2940m, so nothing should ever fly off the end. If it does, put the pod on the
       ground where it is and let the normal impact run rather than stranding the run
       in a state with no way out. */
    if (p.x > CFG.WORLD_M * CFG.M - 400) {
      p.y = World.yAt(p.x) - p.r;
      this.onImpact(p.x, p.y + p.r, p.speed, Math.atan2(Math.max(p.vy, 1), p.vx));
    }
  },

  /* ================= IMPACT MODE =================
     The meteor has arrived. This is the loudest moment in the run, and everything about
     it scales off one number: the energy the launch actually delivered. */
  onImpact(x, y, speed, ang) {
    const p = this.pod;
    const xm = World.mOf(x);
    /* A very fast pod can cross a stage boundary on the same simulation step as contact.
       Resolve it here too, otherwise the early return in updFlying would swallow the cue. */
    this.updateAtmosphereStage(x / CFG.M);
    const pal = World.paletteAt(xm);
    const ground = IMPACT_GROUND[pal.key] || IMPACT_GROUND.grass;

    /* a pod that merely rolled to a stop is a landing, not a crash */
    const budget = speed > CFG.IMPACT_MIN_SPEED ? this.impactBudget(speed) : 0;
    const k = U.clamp(budget / 1.0, 0.06, 2.4);       // 1.0 = a Lv1 PERFECT

    /* site bonuses have to land BEFORE the field is generated: they change its depth
       and its rare-mineral weighting */
    this.run.site = World.siteAt(xm);
    this.run.mine = World.inMine(x);
    if (this.run.site) this.claimSite(this.run.site);
    else {
      const miss = World.nearMiss(xm);
      if (miss) { this.run.nearMiss = miss; SFX.nearMiss(); }
    }

    const impactDepth = this.predictDepth(budget, ground.resist);
    const manual = this.baseDepth * (this.run.mine ? CFG.MINE_DEPTH_MULT : 1) + this.run.bonusDepth;
    const rare = Math.max(this.run.rareMult, this.run.mine ? CFG.MINE_RARE_BOOST : 1);
    World.genUnderground(x, impactDepth + manual, rare, (Math.random() * 1e9) | 0);

    this.run.impactSpeed = speed;
    this.run.impactEnergy = budget;
    this.run.impactDepth = 0;
    this.run.impactDepthTarget = impactDepth;
    this.run.manualDepth = manual;
    this.run.maxDepth = impactDepth + manual;

    p.impactE = budget;
    p.impactE0 = budget;
    p.penAngle = U.clamp(ang, Math.PI * 0.22, Math.PI * 0.78);  // never sideways
    p.soilResist = ground.resist;
    p.drilling = true;
    p.trail.length = 0;
    p.squash = 0.9;
    this.penStopT = 0;
    this.overdrive = 0; p.overdrive = false;
    this.state = 'penetrate';

    UI.setChase(null); UI.setNext(null); UI.showStrip(false);
    UI.setPhase('impact');
    UI.setEnergy(null);
    UI.setSub('');
    /* Push in, do NOT cut. This used to snap `zoom` straight to 0.95 so the half second of
       damping could not sit there showing the whole underground field at once — but
       measured, that snap was 0.40 to 1.04 in a SINGLE frame, a 2.6x jump landing on the
       same frame as the field appearing. A cut that size is not a punch, it is a splice.

       The field reveal is what actually needed fixing (see CFG.UG_REVEAL_T), and with it
       fading up the camera is free to travel. It reads as: hitstop holds the contact frame
       at flight framing, then the camera drives in over ~0.3s while the dig site fades up
       underneath it. The punch is still carried by the freeze, the directional kick, the
       flash and the ejecta. */
    this.cam.tzoom = 1.55;
    this.ugReveal = 0;

    /* ---- the bang ---- */
    /* dig the hole for real, BEFORE the field is drawn or the pod starts penetrating */
    const craterR = CFG.CRATER_R_BASE + CFG.CRATER_R_SCALE * Math.min(k, 1.8);
    const { killed, floorY } = World.carveCrater(
      x,
      craterR,
      CFG.CRATER_DEPTH_BASE + CFG.CRATER_DEPTH_SCALE * Math.min(k, 1.8),
      pal
    );

    /* Put the drill IN the hole. The ballistic contact test snaps the pod to the surface
       it touched, and the line above then removes ~35px of that surface — so the pod was
       left hanging in mid-air above its own fresh crater, and the hitstop froze it there
       for a tenth of a second. The hole appeared before anything hit it, which is exactly
       backwards: the freeze-frame is supposed to show the drill buried at the bottom of
       the crater, mid-explosion. Dropping it onto the new floor on the same frame as the
       flash and the camera kick reads as the impact driving it in, not as a teleport. */
    p.y = Math.max(p.y, floorY);
    /* whatever was standing there gets thrown, rather than just vanishing */
    for (const pr of killed) {
      FX.burst(pr.x, World.yAt(pr.x) - 10, {
        n: 7, dir: -Math.PI / 2, spread: 2.4, spd0: 120, spd1: 460,
        r0: 2, r1: 5, life0: 0.4, life1: 0.9,
        color: [pal.top, pal.top2, pal.soil], g: 1100, shape: 'clod',
      });
    }
    /* 45-120ms. The reference band for an impact freeze is roughly 40-80ms; this sat at
       60-210ms, and a fifth of a second of frozen frames stops reading as a punch and
       starts reading as a hitch. Still scales with energy, just inside sane bounds. */
    this.hitstop(0.045 + 0.042 * Math.min(k, 1.8));
    /* Thrown ALONG the impact direction and much smaller than the first pass (was
       16+30k over 0.68s of pure noise, roughly twice the old game's hardest hit and
       half again as long). The kick carries the punch now, so the number can drop. */
    this.shake(9 + 13 * Math.min(k, 1.6), 0.26 + 0.14 * Math.min(k, 1.5),
               Math.cos(ang), Math.sin(ang));
    Haptics.impact(k);
    /* Capped well short of a whiteout. At the old 0.95 a high-energy hit washed the whole
       screen for a third of a second, which hides the crater and the debris — the two
       things the impact is actually for. The rings and the particle count carry the scale
       instead; the flash is only the first frame of it. */
    this.flash = U.clamp(0.22 + k * 0.3, 0.18, 0.7);
    this.flashColor = ground.spark ? '255,190,120' : '255,240,210';
    this.impactBurst = { x, y: floorY, ang, k, t: 0, life: 0.25 };
    SFX.impact(k);

    FX.ring(x, y, { r0: 10, r1: 120 + 320 * Math.min(k, 1.8), w: 12, color: 'rgba(255,255,255,.9)', life: 0.5 });
    FX.ring(x, y, { r0: 6, r1: 70 + 210 * Math.min(k, 1.8), w: 6, color: U.rgba(U.hex(pal.top2), 0.85), life: 0.38 });
    if (k > 0.8) FX.ring(x, y, { r0: 14, r1: 200 + 380 * k, w: 5, color: 'rgba(255,220,150,.55)', life: 0.75 });
    /* chunks: thrown up and OUT, heavy, biome-coloured */
    /* Ejecta comes off the RIM, across the whole mouth of the crater, and is already a
       frame or two into its flight when it first appears — see FX.spawnAt. Thrown from a
       single point it stacked into one opaque lump that the hitstop then held on screen. */
    const gy = (px) => World.yAt(px);
    FX.burst(x, y, {
      n: Math.round(16 + 40 * Math.min(k, 1.8)), dir: -Math.PI / 2, spread: 2.5,
      spd0: 140, spd1: 380 + 620 * Math.min(k, 1.8), r0: 3, r1: 6 + 5 * Math.min(k, 1.5),
      life0: 0.5, life1: 1.3, color: ground.chunks, g: 1500, shape: 'clod',
      spanX: craterR * 0.8, groundY: gy, lead: 0.05,
    });
    FX.burst(x, y, {
      n: Math.round(10 + 22 * Math.min(k, 1.6)), dir: -Math.PI / 2, spread: 1.1,
      spd0: 300, spd1: 700 + 500 * Math.min(k, 1.6), r0: 2, r1: 5,
      life0: 0.4, life1: 0.9, color: ground.chunks, g: 1300, shape: 'shard',
      spanX: craterR * 0.45, groundY: gy, lead: 0.045,
    });
    FX.dust(x, y, Math.round(16 + 26 * Math.min(k, 1.6)), ground.dust, 1.5 + k * 1.2,
            { spanX: craterR * 0.95, groundY: gy, lead: 0.07 });
    if (ground.spark) {
      FX.burst(x, y, {
        n: Math.round(14 + 26 * k), dir: -Math.PI / 2, spread: 2.2,
        spd0: 200, spd1: 900, r0: 1.5, r1: 3.5, life0: 0.3, life1: 0.8,
        color: [ground.spark, '#fff3b0'], glow: true, g: 900, shrink: true,
        spanX: craterR * 0.5, groundY: gy, lead: 0.04,
      });
    }
    /* a PERFECT arrival gets its own tier, its own colour and its own extra wave, so the
       payoff names the thing the player actually did two seconds earlier */
    if (this.run.perfect) {
      FX.ring(x, y, { r0: 20, r1: 260 + 420 * Math.min(k, 1.8), w: 7, color: 'rgba(255,180,80,.75)', life: 0.95 });
      FX.burst(x, y, {
        n: Math.round(18 + 24 * Math.min(k, 1.6)), dir: -Math.PI / 2, spread: 2.8,
        spd0: 260, spd1: 900, r0: 2, r1: 5, life0: 0.4, life1: 1.1,
        color: ['#fff6d0', '#ffb03a', '#ff6a2a'], glow: true, g: 700, shrink: true,
        spanX: craterR * 0.6, groundY: gy, lead: 0.05,
      });
      this.slowT = 0.3;                  // hold on the crater for a moment
      SFX.perfectImpact(k);
    }
    const tier = this.run.perfect ? 'PERFECT IMPACT!'
      : k > 0.8 ? 'BIG IMPACT!' : k > 0.4 ? 'IMPACT!' : 'WEAK IMPACT';
    this.setBanner(tier, this.run.perfect ? 'MAXIMUM ENERGY' : '',
                   this.run.perfect ? '#ffca6a' : k > 0.8 ? '#ffd08a' : '#e8e0d0',
                   this.run.perfect ? 1.5 : 0.9, 1 + Math.min(k, 1.5) * 0.22);
  },

  /* ---------- PENETRATE: carried by leftover impact energy, no steering yet ---------- */
  updPenetrate(dt) {
    const ug = World.ug, p = this.pod;
    const r = this.run;

    if (p.impactE > 0) {
      const step = p.updatePenetrate(dt, ug, {
        mineral: (m) => this.onMineral(m, true),
        rock: (rk) => this.onPenetrateRock(rk),
      });
      r.impactDepth = (p.y - ug.surfaceY) / CFG.M;
      /* keep the run's own depth in step during penetration too. updDrill is the only
         other place that writes it, so until manual control started this read as 0 — fine
         for the result screen (drilling always follows) but wrong for anything that looks
         at the run mid-impact, including Save.data.deepest if a run ever ends in here. */
      r.depth = Math.max(r.depth, r.impactDepth);
      UI.setStat(Math.max(0, r.impactDepth));

      /* destruction scales with how fast the drill is still travelling */
      const kv = U.clamp(step.v / 700, 0.05, 1.4);
      const pal = World.paletteAt(p.x / CFG.M);
      const ground = IMPACT_GROUND[pal.key] || IMPACT_GROUND.grass;
      const n = Math.round(1 + kv * 5);
      for (let i = 0; i < n; i++) {
        const a = p.penAngle + Math.PI + U.rand(-1.5, 1.5);
        FX.add({
          x: p.x + U.rand(-10, 10), y: p.y + U.rand(-8, 8),
          vx: Math.cos(a) * U.rand(60, 340) * kv, vy: Math.sin(a) * U.rand(60, 300) * kv - 40,
          r: U.rand(2.5, 6.5), life: U.rand(0.3, 0.8), color: U.pick(ground.chunks),
          g: 900, drag: 1.6, shape: 'clod', vr: U.rand(-10, 10),
        });
      }
      if (ground.spark && Math.random() < kv * 0.7) {
        FX.add({
          x: p.x + U.rand(-8, 8), y: p.y + 10, vx: U.rand(-120, 120), vy: U.rand(-180, -40),
          r: U.rand(1.2, 2.6), life: U.rand(0.2, 0.5), color: ground.spark,
          g: 600, glow: true, shrink: true,
        });
      }
      /* crossing a strata band throws a bigger burst — the depth bands become audible */
      const band = Math.floor(r.impactDepth / 8);
      if (band !== r.lastBand && kv > 0.25) {
        r.lastBand = band;
        this.shake(2.5 + kv * 4, 0.14, 0, 1);
        this.flash = Math.max(this.flash, 0.035 + kv * 0.045);
        this.flashColor = ground.spark ? '255,145,70' : '255,220,170';
        Haptics.tick(kv);
        FX.ring(p.x, p.y, {
          r0: 5, r1: 34 + kv * 42, w: 3.5,
          color: U.rgba(U.hex(ground.spark || pal.top), 0.52), life: 0.25,
        });
        FX.burst(p.x, p.y, {
          n: Math.round(4 + kv * 10), dir: p.penAngle + Math.PI, spread: 2.6,
          spd0: 90, spd1: 150 + kv * 420, r0: 2.5, r1: 6, life0: 0.3, life1: 0.7,
          color: ground.chunks, g: 1000, shape: 'shard',
        });
        SFX.crunch(kv);
      }
      /* NO per-frame shake here. shake() keeps the largest magnitude it has been given,
         so calling it every frame pinned the camera at full jitter for the whole
         penetration — a continuous rumble with no decay, and the single worst part of
         the impact feel. The strata bursts above carry the digging instead. */
      if (p.impactE <= 0) {
        /* energy spent: brief pause, then the motor takes over */
        p.vx = 0; p.vy = 0;
        this.penStopT = 0;
        r.impactDepthFinal = Math.max(0, r.impactDepth);
        this.setBanner('IMPACT DEPTH', Math.round(r.impactDepthFinal) + 'm', '#ffd08a', 1.1, 1.15);
        SFX.settleThud();
        Haptics.settle();
      }
      return;
    }

    /* the beat between crash and control */
    this.penStopT += dt;
    p.tickSquash(dt);
    p.spin += dt * U.lerp(30, 10, U.clamp(this.penStopT / CFG.IMPACT_STOP_T, 0, 1));
    if (this.penStopT >= CFG.IMPACT_STOP_T) this.startDrill();
  },

  onPenetrateRock(rk) {
    this.shake(9, 0.22);
    this.hitstop(0.03);
    SFX.rock();
    FX.burst(rk.x, rk.y, {
      n: 16, spd0: 80, spd1: 340, r0: 3, r1: 7, life0: 0.3, life1: 0.7,
      color: ['#7d7a86', '#4a4753', '#9a97a4'], g: 900, shape: 'shard',
    });
  },

  /* hand control to the player. The field already exists (built at impact) and the pod
     is the same pod at the depth its crash earned — nothing respawns. */
  startDrill() {
    const r = this.run;
    this.state = 'drill';
    this.pod.drilling = true;
    this.pod.vx = 0; this.pod.vy = 10;
    /* IMPACT DEPTH is free, MANUAL DEPTH is the DRILL stat, and the two stack: the floor
       sits `manualDepth` below wherever the crash actually finished. */
    World.setFloor(this.pod.y + r.manualDepth * CFG.M);
    r.maxDepth = World.ug.maxDepthM;
    UI.setPhase('drill');
    UI.setStat(r.impactDepthFinal || 0);
    UI.setHaul(r.count);
    UI.setSub('MAX DEPTH', Math.round(r.maxDepth) + 'm');
    if (Save.data.runs < 2) UI.showHint('steer');
    SFX.startDrill();
    FX.ring(this.pod.x, this.pod.y, { r0: 4, r1: 70, w: 4, color: 'rgba(255,210,120,.7)', life: 0.35 });
    FX.burst(this.pod.x, this.pod.y + 8, {
      n: 14, dir: -Math.PI / 2, spread: 2.4,
      spd0: 50, spd1: 230, r0: 1.5, r1: 4, life0: 0.2, life1: 0.5,
      color: ['#fff3b0', '#ffb03a', '#ffffff'], glow: true, g: 180, shape: 'shard',
    });
    this.flash = Math.max(this.flash, 0.16); this.flashColor = '255,205,110';
    this.shake(4.5, 0.2, 0, 1);
    SFX.motorKick();
  },

  /* ---------- DRILL ---------- */
  updDrill(dt) {
    const ug = World.ug;
    let steer = this.input.down ? this.input.steer : 0;
    if (this.input.keyL) steer -= 1;
    if (this.input.keyR) steer += 1;
    this.pod.steer = U.clamp(steer, -1, 1);

    this.pod.updateDrill(dt, ug, {
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
        g: 260, drag: 1.4, shape: 'clod', vr: U.rand(-9, 9),
      });
    }
    /* A turn throws spoil off the wall it is biting into, on the OUTSIDE of the turn.
       Without it a hard turn and a straight line look identical and steering has no
       weight; with it the drill visibly shoulders into the rock. */
    const sd = Math.abs(this.pod.steer);
    if (sd > 0.18 && Math.random() < sd * 0.8) {
      const dir = this.pod.steer > 0 ? 1 : -1;
      FX.add({
        x: this.pod.x + dir * this.pod.r * 0.8, y: this.pod.y + U.rand(-4, 10),
        vx: dir * U.rand(60, 240) * sd, vy: U.rand(-120, 40),
        r: U.rand(2, 5.5), life: U.rand(0.25, 0.55),
        color: U.pick(['#a98a5f', '#8a6a44', '#6f5a44']),
        g: 700, drag: 1.5, shape: 'clod', vr: U.rand(-12, 12),
      });
    }

    /* the only end condition: the drill has reached the depth its DRILL stat allows */
    if (this.pod.y >= ug.botY) {
      this.pod.y = ug.botY;
      this.shake(14, 0.4);
      FX.burst(this.pod.x, ug.botY, {
        n: 22, dir: -Math.PI / 2, spread: 2.6, spd0: 90, spd1: 340,
        r0: 2, r1: 6, color: ['#ffd23d', '#ffffff', '#8a8aa0'], g: 900, shape: 'rock',
      });
      SFX.thud();
      this.endRun('MAX DEPTH');
    }
  },

  onMineral(m, fromImpact) {
    const def = MINERALS[m.type];
    const r = this.run;
    r.haul.push(m.type);
    r.count++;
    UI.setHaul(r.count);

    /* chain: linking pickups without a gap pays more, so steering is worth doing well.
       An impact pickup pays face value and never builds the chain: penetration is not
       steered, so rewarding it like steering would undercut the drilling phase. */
    let mult = 1;
    if (fromImpact) {
      r.impactHaul = (r.impactHaul || 0) + 1;
    } else {
      r.chain = r.chainT > 0 ? r.chain + 1 : 1;
      r.chainT = 1.15;
      r.bestChain = Math.max(r.bestChain, r.chain);
      mult = Math.min(3, 1 + (r.chain - 1) * 0.5);
    }
    const gained = Math.round(def.value * mult);
    r.mineralCoins += gained;

    FX.text(m.x, m.y - 12, '+' + gained, { color: def.edge, size: 20 + (mult - 1) * 7, life: 0.85 });
    if (fromImpact) FX.text(m.x, m.y - 38, 'CRACK!', { color: '#ffe9a8', size: 15, life: 0.55, vy: -20 });
    if (!fromImpact && r.chain > 1) {
      FX.text(m.x, m.y - 40, 'CHAIN ×' + mult.toFixed(1).replace('.0', ''), {
        color: '#ffd85e', size: 15 + r.chain, life: 0.7, vy: -30,
      });
    }
    SFX.pick(fromImpact ? 2 : r.chain - 1);
    FX.ring(m.x, m.y, { r0: 4, r1: def.tier === 2 ? 130 : 52, w: 4, color: U.rgba(def.color, 0.85), life: 0.4 });
    FX.burst(m.x, m.y, {
      n: def.tier === 2 ? 26 : 12, spd0: 60, spd1: def.tier === 2 ? 340 : 180,
      r0: 2, r1: def.tier === 2 ? 6 : 4, life0: 0.3, life1: 0.8,
      color: [def.color, def.edge, '#ffffff'], glow: true, g: 260, shape: 'shard',
    });

    if (def.tier === 2) {
      this.hitstop(0.1);
      this.slowT = 0.45;
      /* kept under the impact flash: a rare find is a highlight, the arrival is the
         headline, and the brightest thing on screen should be the headline */
      this.flash = 0.58; this.flashColor = '255,255,255';
      this.shake(18, 0.5);
      this.setBanner('RARE FIND!', def.name, def.edge, 1.5, 1.2);
      SFX.rare();
      Haptics.rare();
    } else {
      this.hitstop(def.tier === 1 ? 0.035 : 0.02);
      this.shake(def.tier === 1 ? 8 : 4, 0.14);
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

  /* ---------- camera ----------
     Two parts, because they say different things:
       KICK  — a decaying oscillation along the axis the hit came from. This is the event.
       NOISE — a little uncorrelated jitter on top. This is only texture.
     It used to be noise alone, at the full magnitude, which reads as a broken screen
     rather than a punch and is what made the meteor impact nauseating. A directional
     kick at HALF the old magnitude lands harder than pure noise at twice it.
     `dx, dy` is the direction to throw the camera; omit it for an undirected rumble. */
  shake(mag, dur, dx, dy) {
    const m = mag * this.shakeScale;
    if (m <= 0.02) return;
    const c = this.cam;
    c.shake = Math.max(c.shake, m);
    c.shakeT = Math.max(c.shakeT, dur);
    c.shakeDur = c.shakeT;
    if (dx !== undefined) {
      const len = Math.hypot(dx, dy) || 1;
      c.kickX = (dx / len) * m;
      c.kickY = (dy / len) * m;
      c.kickT = dur;
      c.kickDur = dur;
    }
  },
  get shakeScale() {
    const v = Save.data && Save.data.shake;
    return v === undefined ? 1 : v;
  },

  updCamera(dt, rawDt) {
    const c = this.cam, p = this.pod;

    if (this.state === 'flying') {
      /* Three emotions, one damped chain. CLIMBING: ride the pod, so the ground drops away
         underneath and altitude reads as leaving somewhere. FALLING: push the framing DOWN
         toward the ground the pod is about to hit, so the impact point is on screen well
         before it happens.

         The climbing weight used to be 0.55 on the pod, which meant the ground receded at
         barely half the rate the pod climbed and then parked near the bottom of the screen
         for the rest of the arc — measured, it moved from 65% to 87% of screen height over
         a 217m climb and stopped. At 0.90 the ground is properly gone by apex. `fall`
         hands the framing back on the way down, and it gets there fast: half a second of
         falling is already vy 700, which is fall 0.5. */
      const gy = World.yAt(p.x);
      const alt = Math.max(0, gy - p.r - p.y);
      const fall = this.run.fall || 0;
      const lead = U.clamp(p.vx * 0.14, 0, 260);
      c.x = U.damp(c.x, p.x + lead, 5.5, dt);
      c.y = U.damp(c.y, p.y * (0.90 - fall * 0.55) + (gy - 120) * (0.10 + fall * 0.55), 4.2, dt);
      /* APEX: an extra beat of pull-back so the whole arc, and the ground waiting under
         it, are both readable for a moment before the fall starts */
      const apex = U.clamp((this.run.apexT || 0) / 0.55, 0, 1);
      c.tzoom = U.clamp(1.02 - alt / 2100 - p.speed / 5200 - apex * 0.1, 0.28, 1.05);
      c.anchor = U.lerp(0.55, 0.42, fall);
    } else if (this.state === 'penetrate') {
      /* ride it down, tight, so the destruction fills the frame */
      c.x = U.damp(c.x, p.x, 7, dt);
      c.y = U.damp(c.y, p.y + 60, 6, dt);
      c.tzoom = U.damp(c.tzoom, this.pod.impactE > 0 ? 1.55 : 2.2, 3, dt);
      c.anchor = U.damp(c.anchor, 0.4, 4, dt);
      c.zoom = U.damp(c.zoom, c.tzoom, 7, dt);       // faster than the global 3.2
    } else if (this.state === 'flying') {
      const gy = World.yAt(p.x);
      const od = this.overdrive > 0 ? 1 : 0;
      /* Look-ahead is a share of the VISIBLE width, not a fixed pixel count: at speed
         the pod sits ~30% in from the left at any zoom, so the site it is heading for is
         on screen well before it gets there. Overdrive leans further. */
      const view = (this.W / 2) / Math.max(0.3, c.zoom);
      const lead = U.clamp(p.vx * (0.16 + od * 0.06), 0, view * (0.42 + od * 0.08));
      c.x = U.damp(c.x, p.x + lead, 6 + od * 1.6, dt);
      c.y = U.damp(c.y, p.y * 0.62 + (gy - 150) * 0.38, 4.5, dt);
      const alt = Math.max(0, gy - p.y);
      c.tzoom = U.clamp(1.08 - p.speed / 3400 - alt / 2600 - od * 0.09, 0.34, 1.1);
      c.anchor = 0.55;
    } else if (this.state === 'drill') {
      /* lean the framing into the turn: it shows a little more of the ground the drill is
         heading for, and it is what makes a small stick movement read as a decision */
      c.x = U.damp(c.x, p.x + p.steer * 34, 5, dt);
      c.y = U.damp(c.y, p.y + 40, 4.5, dt);
      c.tzoom = 2.4; c.anchor = 0.34;
    } else if (this.state === 'result') {
      c.y = U.damp(c.y, p.y + 40, 3, dt);
    }

    c.zoom = U.damp(c.zoom, c.tzoom, 3.2, dt);
    c.bz = U.damp(c.bz, c.zoom, 9, rawDt);

    if (c.shakeT > 0 || c.kickT > 0) {
      let sx = 0, sy = 0;
      if (c.shakeT > 0) {
        c.shakeT -= rawDt;
        const k = U.clamp(c.shakeT / (c.shakeDur || 1), 0, 1);
        /* noise is now a fraction of the magnitude, not all of it */
        const m = c.shake * k * k * 0.38;
        sx += U.rand(-m, m); sy += U.rand(-m, m);
        if (c.shakeT <= 0) c.shake = 0;
      }
      if (c.kickT > 0) {
        c.kickT -= rawDt;
        const k = U.clamp(c.kickT / (c.kickDur || 1), 0, 1);
        /* one firm throw, then a couple of settling swings */
        const osc = Math.sin((c.kickDur - c.kickT) * 34) * k * k;
        sx += c.kickX * osc; sy += c.kickY * osc;
        if (c.kickT <= 0) { c.kickX = c.kickY = 0; }
      }
      c.sx = sx; c.sy = sy;
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
    const underground = (this.state === 'drill' || this.state === 'result' ||
                         this.state === 'penetrate') && World.ug;
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
    if (underground) World.drawUnderground(ctx, c, left, right, top, bottom, this.ugReveal);

    this.drawPad(ctx);
    this.drawBestFlag(ctx, left, right);
    if (this.showZones) this.drawZoneDebug(ctx, left, right);

    this.pod.drawTrail(ctx);
    FX.draw(ctx, c.zoom);
    this.pod.draw(ctx);

    ctx.restore();

    /* screen space overlays */
    this.drawImpactBurst(ctx, W, H);
    this.drawStageTransition(ctx, W, H);
    if (this.state === 'ready' || this.state === 'charge') this.drawMeter(ctx, W, H);
    this.drawBanner(ctx, W, H);
    this.drawVignette(ctx, W, H);
    if (this.showZones) this.drawFlightDebug(ctx, W, H);
    if (this.flash > 0.001) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.75})`;
      ctx.fillRect(0, 0, W, H);
    }
  },

  drawPad(ctx) {
    /* the pod's art is shifted back along its axis (NOSE_PIVOT), so seat the pad under
       where it actually renders, not under its collision point. 0.94 = cos(rest angle). */
    const px = this.padX;
    const x = px - this.pod.r * NOSE_PIVOT * 0.94, y = World.yAt(px);
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

  /* screen-space physics readout (debug only — never shown in normal play) */
  drawFlightDebug(ctx, W, H) {
    const r = this.run, p = this.pod;
    const alt = Math.max(0, (World.yAt(p.x) - p.r) - p.y);
    const ke = this.kinetic(p), pe = this.potential(p);
    const lines = [
      `SURFACE IMPACT   state ${this.state}   angle ${Math.round(CFG.IMPACT_ANGLE * 180 / Math.PI)}deg`,
      `vx ${Math.round(p.vx)}  vy ${Math.round(p.vy)}  speed ${Math.round(p.speed)}  height ${(alt / CFG.M).toFixed(1)}m`,
      `KE ${(ke / 1000).toFixed(0)}k  PE ${(pe / 1000).toFixed(0)}k  ME ${((ke + pe) / 1000).toFixed(0)}k` +
        `  (launch ME ${(r.launchME / 1000).toFixed(0)}k)`,
      `impact budget ${r.impactEnergy.toFixed(3)}  left ${p.impactE.toFixed(3)}  eff x${this.impactEfficiency().toFixed(2)}`,
      `impact depth ${r.impactDepth.toFixed(1)}m / predicted ${r.impactDepthTarget.toFixed(1)}m  + manual ${r.manualDepth.toFixed(0)}m`,
      `soil resist x${p.soilResist.toFixed(2)}  base ${CFG.SOIL_RESISTANCE}  harden ${CFG.SOIL_HARDEN_PER_M}/m`,
    ];
    ctx.save();
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(8, H * 0.5, 330, 14 * lines.length + 8);
    ctx.fillStyle = '#b6ffd0';
    lines.forEach((l, k) => ctx.fillText(l, 12, H * 0.5 + 4 + k * 14));
    ctx.restore();
  },

  drawBestFlag(ctx, left, right) {
    const b = Save.data.best;
    if (b <= 5) return;
    /* BEST is a launch distance, so the flag is planted that far from THIS pad. */
    const x = this.padX + b * CFG.M;
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
  drawStageTransition(ctx, W, H) {
    const b = this.stageBanner;
    if (!b) return;
    const k = U.clamp(b.t / b.life, 0, 1);
    const enter = U.easeOutBack(U.clamp(b.t / 0.32, 0, 1));
    const alpha = k < 0.72 ? 1 : 1 - (k - 0.72) / 0.28;
    const S = this.S;

    ctx.save();
    if (this.stageWash > 0) {
      ctx.save();
      ctx.globalAlpha = this.stageWash * 0.12;
      ctx.fillStyle = b.accent;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.12);
      ctx.fillRect(-W, -H * 0.13, W * 2, H * 0.26);
      ctx.restore();
    }

    ctx.globalAlpha = alpha;
    /* Below the persistent NEXT card, above the action. At 0.205 it sat directly behind
       the card on a 9:16 phone and looked like a clipped label. */
    ctx.translate(W / 2, H * 0.255);
    ctx.scale(enter, enter);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(6,10,20,.72)';
    ctx.lineWidth = 7 * S;
    ctx.font = `bold ${26 * S}px ${FONT}`;
    ctx.strokeText(b.name, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.name, 0, 0);
    ctx.fillStyle = b.accent;
    ctx.fillRect(-78 * S, 19 * S, 156 * S, 2 * S);
    ctx.font = `bold ${10 * S}px ${FONT}`;
    ctx.letterSpacing = `${1.8 * S}px`;
    ctx.fillText(b.sub, 0, 33 * S);
    ctx.restore();
  },

  /* A short directional star locked to the actual contact point. It survives most of
     hitstop, so frame zero reads as a violent strike before debris has had time to move. */
  drawImpactBurst(ctx, W, H) {
    const b = this.impactBurst;
    if (!b) return;
    const c = this.cam;
    const x = W / 2 + (b.x - (c.x + c.sx)) * c.zoom;
    const y = H * c.anchor + (b.y - (c.y + c.sy)) * c.zoom;
    const k = U.clamp(b.t / b.life, 0, 1);
    const a = (1 - k) * (1 - k);
    const size = (38 + Math.min(b.k, 1.8) * 48) * (0.72 + k * 0.75) * this.S;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#fff4d6';
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i / 12) * U.TAU);
      const long = size * (i % 3 === 0 ? 1.45 : 0.82);
      ctx.beginPath();
      ctx.moveTo(0, -2.4 * this.S);
      ctx.lineTo(long, 0);
      ctx.lineTo(0, 2.4 * this.S);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, size * 0.18, 0, U.TAU); ctx.fill();
    ctx.restore();
  },

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
