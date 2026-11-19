// Realistic ⇄ anime glitch, Canvas 2D. Calm most of the time; short irregular bursts.
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function layer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// base artwork at canvas size; the r/g/b split layers are built later, on demand
function baseOf(img, w, h) {
  const base = layer(w, h);
  base.getContext('2d').drawImage(img, 0, 0, w, h);
  return { base };
}
function addChannels(set, w, h) {
  if (set.r) return;
  for (const [k, col] of [['r', '#f00'], ['g', '#0f0'], ['b', '#00f']]) {
    const c = layer(w, h), x = c.getContext('2d');
    x.drawImage(set.base, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = col; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(set.base, 0, 0);
    set[k] = c;
  }
}
const cache = new Map(); // one prepared set per dish and size, reused on every visit

export class Glitch {
  constructor(canvas, { onMode, onBurst } = {}) {
    this.cv = canvas;
    this.onBurst = onBurst;
    this.ctx = canvas.getContext('2d');
    this.onMode = onMode;
    this.raf = 0;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setDish(images, cssW, cssH, key = '') {
    // The source art is only ~380 px wide, so a canvas bigger than that adds pixels, not detail.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const natW = images.real.naturalWidth || 380;
    const w = Math.round(Math.min(cssW * dpr, natW * 1.25));
    const h = Math.round(w * cssH / cssW);
    this.cv.width = w; this.cv.height = h;
    this.cv.style.width = cssW + 'px'; this.cv.style.height = cssH + 'px';
    this.w = w; this.h = h; this.k = w / 380; // glitch amounts scale with size
    const ck = `${key}|${w}x${h}`;
    let set = cache.get(ck);
    if (!set) {
      const shadow = layer(w, h); shadow.getContext('2d').drawImage(images.shadow, 0, 0, w, h);
      set = { real: baseOf(images.real, w, h), anime: baseOf(images.anime, w, h), shadow };
      cache.set(ck, set);
    }
    this.src = set; this.shadow = set.shadow;
    this.scratch = this.scratch && this.scratch.width === w && this.scratch.height === h ? this.scratch : layer(w, h);
    this.sx = this.scratch.getContext('2d');
    this.mode = 'real';
    this.burstUntil = 0; this.nextBurst = 0; this.nextFrame = 0;
    this.drawCalm();
  }

  // build the colour-split layers when the page is idle (after the fly-in), or right before a burst
  prepare() {
    const run = () => { if (this.src) { addChannels(this.src.real, this.w, this.h); addChannels(this.src.anime, this.w, this.h); } };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 600 }); else setTimeout(run, 60);
  }

  start(firstBurstDelay = 420) {
    this.stop();
    const now = performance.now();
    this.nextBurst = this.reduced ? Infinity : now + firstBurstDelay;
    const tick = (t) => { this.raf = requestAnimationFrame(tick); this.frame(t); };
    this.raf = requestAnimationFrame(tick);
  }

  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  setMode(m) {
    if (this.mode === m) return;
    this.mode = m;
    this.onMode && this.onMode(m);
  }

  // user asked for a flip (tap on dish / mode chip)
  flip() {
    const target = this.mode === 'real' ? 'anime' : 'real';
    if (this.reduced) { this.setMode(target); this.drawCalm(); return; }
    this.burst(performance.now(), rand(260, 380), target);
  }

  burst(now, dur, endMode) {
    this.burstUntil = now + dur;
    this.endMode = endMode;
    this.onBurst && this.onBurst(dur);
    this.nextFrame = 0;
  }

  frame(t) {
    if (t >= this.nextBurst && t > this.burstUntil) {
      // irregular: sometimes land on anime and hold it, usually come back to real
      const end = this.mode === 'real' ? (Math.random() < 0.38 ? 'anime' : 'real')
                                       : (Math.random() < 0.75 ? 'real' : 'anime');
      this.burst(t, rand(160, 460), end);
      this.nextBurst = t + rand(1500, 3800) + (end === 'anime' ? 600 : 0);
    }
    if (t < this.burstUntil) {
      if (t >= this.nextFrame) { this.drawGlitch(); this.nextFrame = t + rand(34, 85); }
    } else if (this.burstUntil) {
      this.burstUntil = 0;
      this.setMode(this.endMode);
      this.drawCalm();
    }
  }

  drawCalm() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.shadow, 0, 0);
    ctx.drawImage(this.src[this.mode].base, 0, 0);
  }

  drawGlitch() {
    const { ctx, sx, w, h, k } = this;
    addChannels(this.src.real, w, h); addChannels(this.src.anime, w, h); // no-op once built
    const other = this.mode === 'real' ? 'anime' : 'real';
    const main = this.src[Math.random() < 0.55 ? other : this.mode];
    const alt = main === this.src.real ? this.src.anime : this.src.real;

    // 1 — RGB split
    sx.clearRect(0, 0, w, h);
    sx.globalCompositeOperation = 'lighter';
    const d = rand(4, 16) * k * (Math.random() < .5 ? -1 : 1);
    const dv = rand(-3, 3) * k;
    sx.drawImage(main.r, -d, dv * .5);
    sx.drawImage(main.g, 0, 0);
    sx.drawImage(main.b, d, -dv);
    sx.globalCompositeOperation = 'source-over';

    // 2 — horizontal slices, displaced; some pulled from the other artwork
    const n = 2 + (Math.random() * 5 | 0);
    for (let i = 0; i < n; i++) {
      const sh = rand(4, 46) * k, sy = rand(0, h - sh);
      const off = rand(-38, 38) * k;
      const from = Math.random() < 0.5 ? alt.base : main.base;
      sx.clearRect(0, sy, w, sh);
      sx.drawImage(from, 0, sy, w, sh, off, sy, w, sh);
    }

    // 3 — duplicated fragment
    if (Math.random() < 0.45) {
      const fw = rand(.25, .6) * w, fh = rand(10, 34) * k;
      const fx = rand(0, w - fw), fy = rand(0, h - fh);
      sx.drawImage(pick([main.base, alt.base]), fx, fy, fw, fh, fx + rand(-30, 30) * k, fy + rand(-60, 60) * k, fw, fh);
    }

    // 4 — scanlines / noise, only on the dish
    sx.globalCompositeOperation = 'source-atop';
    const lines = 3 + (Math.random() * 6 | 0);
    for (let i = 0; i < lines; i++) {
      sx.fillStyle = Math.random() < .3 ? 'rgba(229,35,27,.55)' : `rgba(${Math.random() < .5 ? '255,255,255' : '14,13,12'},${rand(.08, .3)})`;
      sx.fillRect(0, rand(0, h), w, rand(1, 3) * k);
    }
    sx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.shadow, 0, 0);
    ctx.drawImage(this.scratch, 0, 0);
  }
}
