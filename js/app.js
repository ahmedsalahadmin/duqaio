import { BRAND, MENU, MONEY, DELIVERY_FEE } from './data.js';
import { Glitch } from './glitch.js';
import { doodle, clearDoodles, burst, NEON } from './doodles.js';
import { haptic, hapticSoon, HAPTIC, hapticInfo, addTouchSwitch, addTouchSwitches } from './haptics.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const money = new Intl.NumberFormat(MONEY.locale, { style: 'currency', currency: MONEY.currency, minimumFractionDigits: MONEY.decimals ?? 2, maximumFractionDigits: MONEY.decimals ?? 2 });
const fmt = (v) => money.format(v);
const pad2 = (n) => String(n).padStart(2, '0');
const byId = Object.fromEntries(MENU.map((d, i) => [d.id, { ...d, index: i }]));
const img = (id, kind) => `assets/dishes/${id}_${kind}.webp`;
const HEAT = ['', 'MILD HEAT', 'HOT', 'EXTRA HOT'];
const chilis = (n) => Array.from({ length: n }, (_, i) => `<svg class="chili" style="--i:${i}" aria-hidden="true"><use href="#chili"/></svg>`).join('');

// ─── Brand ───────────────────────────────────────────────
document.title = `${BRAND.name} Noodle Universe`;
document.querySelectorAll('[data-brand]').forEach((e) => (e.textContent = BRAND.name));
document.querySelectorAll('[data-brand-jp]').forEach((e) => (e.textContent = BRAND.jp));
$('#bowlCount').textContent = `${pad2(MENU.length)} BOWLS`;

// ─── Images ──────────────────────────────────────────────
const images = {};
function load(src) {
  return new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
}
const menuReady = Promise.all(MENU.map(async (d) => { images[d.id] = { menu: await load(img(d.id, 'menu')) }; }));
const heroReady = menuReady.then(() => Promise.all(MENU.map(async (d) => {
  const [real, anime, shadow] = await Promise.all(['real', 'anime', 'shadow'].map((k) => load(img(d.id, k))));
  Object.assign(images[d.id], { real, anime, shadow });
})));

// ─── Cart ────────────────────────────────────────────────
const CART_KEY = `${BRAND.name.toLowerCase()}-cart`;
const cart = new Map();
try { for (const [id, q] of JSON.parse(localStorage.getItem(CART_KEY) || '[]')) if (byId[id] && q > 0) cart.set(id, q); } catch {}
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify([...cart])); } catch {} };
const cartCount = () => [...cart.values()].reduce((a, b) => a + b, 0);
const subtotal = () => [...cart].reduce((s, [id, q]) => s + byId[id].price * q, 0);

const fab = $('#fab');
function updateFab(bump) {
  const n = cartCount();
  $('#fabCount').textContent = n;
  fab.hidden = n === 0;
  app.classList.toggle('has-order', n > 0);
  fab.setAttribute('aria-label', `My orders, ${n} item${n === 1 ? '' : 's'}`);
  if (bump) { fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); }
}
updateFab();

// ═══ Universe ═══════════════════════════════════════════
const universe = $('#universe');
const itemsEl = $('#items');
// Two layout options, chosen with ?layout=a (halo, default) or ?layout=b (wheel).
// Ring sizes are fractions of the short screen side.
const LAYOUTS = {
  // exactly one spot per dish, so nothing repeats
  halo: [{ n: MENU.length, f: 0.58, size: 0.50, speed: 1, phase: -Math.PI / 2, shift: 0 }],
  wheel: [{ n: MENU.length, f: 0.70, size: 0.64, speed: 1, phase: -Math.PI / 2, shift: 0 }],
};
const savedLayout = (() => { try { return localStorage.getItem('duqaio-layout'); } catch { return null; } })();
let LAYOUT = (params.get('layout') || savedLayout) === 'b' ? 'wheel' : 'halo';
let RINGS, STEP;
const items = [];

function buildItems() {
  RINGS = LAYOUTS[LAYOUT];
  STEP = (Math.PI * 2) / RINGS[0].n;
  items.length = 0;
  itemsEl.textContent = '';
  RINGS.forEach((ring, r) => {
    for (let i = 0; i < ring.n; i++) {
      const dish = MENU[(i + ring.shift) % MENU.length];
      const first = !items.some((it) => it.dish === dish);
      const el = document.createElement('button');
      el.className = 'dish';
      el.innerHTML = `<img alt="" draggable="false" src="${img(dish.id, 'menu')}">${dish.heat ? `<span class="heat-cluster h${dish.heat}">${chilis(dish.heat)}</span>` : ''}`;
      if (first) el.setAttribute('aria-label', `${dish.name}, ${fmt(dish.price)}${dish.heat ? `, ${HEAT[dish.heat].toLowerCase()}` : ''}`);
      else { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); }
      itemsEl.appendChild(el);
      addTouchSwitch(el); // iPhone tick when a bowl is tapped
      items.push({ el, dish, ring: r, a0: (i / ring.n) * Math.PI * 2, phase: Math.random() * 6.28, x: 0, y: 0, w: 0, h: 0, sc: 1, rot: 0, z: -1 });
    }
  });
}

function applyLayoutClass() {
  app.classList.toggle('layout-halo', LAYOUT === 'halo');
  app.classList.toggle('layout-wheel', LAYOUT === 'wheel');
  document.querySelectorAll('#layoutSwitch [data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === LAYOUT)));
}
applyLayoutClass();
buildItems();

// Showcase switch: swap A (halo) ⇄ B (wheel) live, keeping the cart and the URL in sync
let switching = false;
function setLayout(name) {
  if (name === LAYOUT || switching || frozen) return;
  switching = true;
  const orbit = $('#orbit');
  orbit.classList.add('swapping');
  setTimeout(() => {
    LAYOUT = name;
    applyLayoutClass();
    buildItems();
    layout();
    theta = 0; omega = 0; focused = null; doodledFor = null;
    clearDoodles(menuDoodles, '.sel, .selw');
    render(performance.now());
    const u = new URL(location.href);
    u.searchParams.set('layout', name === 'wheel' ? 'b' : 'a');
    try { localStorage.setItem('duqaio-layout', name === 'wheel' ? 'b' : 'a'); } catch {}
    history.replaceState(history.state, '', u);
    orbit.classList.remove('swapping');
    switching = false;
  }, reduced ? 0 : 260);
}
document.querySelectorAll('#layoutSwitch [data-layout]').forEach((b) => (b.onclick = () => { haptic(HAPTIC.tick); setLayout(b.dataset.layout); }));

let W = 0, H = 0, CX = 0, CY = 0, geo = [];
const HALO_TOP = 1.3; // scale of the selected (top) bowl in the halo
function layout() {
  W = innerWidth; H = innerHeight;
  const landscape = W > H;
  if (LAYOUT === 'wheel') {
    // hub sits low; the top of the wheel holds the focused bowl, neighbours peek in at the sides
    const R = Math.min(W, H * 0.6);
    const r = RINGS[0].f * R;
    CX = W / 2; CY = H * 0.36 + r;
    geo = [{ rx: r, ry: r, s: Math.min(RINGS[0].size * R, 380) }];
  } else {
    const R = Math.min(W, H) * (landscape ? 0.82 : 1);
    const kx = landscape ? Math.min(W / H, 1.75) : 1;
    const ky = landscape ? 1 : Math.min((H / W) * 0.6, 1.3);
    geo = RINGS.map((ring) => ({ rx: ring.f * R * kx, ry: ring.f * R * ky, s: Math.min(ring.size * R, 360) }));
    // the selected bowl sits at the top of the ring, enlarged; push the ring down so it clears the top bar
    const ry = geo[0].ry;
    const hTop = geo[0].s * 1.18 * HALO_TOP;
    CX = W / 2;
    CY = Math.max(H / 2, (landscape ? 54 : 62) + hTop / 2 + ry);
  }
  const focusEl = $('#focus'), mega = $('.mega');
  if (LAYOUT === 'halo') {
    const ry = geo[0].ry, hTop = geo[0].s * 1.18 * HALO_TOP;
    focusEl.style.top = CY - ry + hTop / 2 + 6 + 'px';
    mega.style.top = CY + ry * 0.3 + 'px';
  } else {
    focusEl.style.top = ''; mega.style.top = '';
  }
  for (const it of items) {
    const ar = (images[it.dish.id]?.menu?.naturalHeight || 450) / (images[it.dish.id]?.menu?.naturalWidth || 380);
    it.w = geo[it.ring].s; it.h = it.w * ar; it.key = null;
    it.el.style.width = it.w + 'px'; it.el.style.height = it.h + 'px';
  }
  drawAmbient();
}

// ─── Neon doodles in the menu ────────────────────────────
const menuDoodles = $('#menuDoodles');
const AMBIENT = [
  { type: 'spiral', fx: 0.10, fy: 0.24, size: 46, c: 'teal' },
  { type: 'cross', fx: 0.90, fy: 0.36, size: 34, c: 'pink' },
  { type: 'zigzag', fx: 0.14, fy: 0.64, size: 58, c: 'green' },
  { type: 'face', fx: 0.88, fy: 0.74, size: 44, c: 'green' },
  { type: 'rays', fx: 0.84, fy: 0.14, size: 36, c: 'pink' },
  { type: 'squiggle', fx: 0.56, fy: 0.95, size: 70, c: 'teal' },
];
function drawAmbient() {
  clearDoodles(menuDoodles, '.amb');
  AMBIENT.forEach((a, i) => doodle(menuDoodles, a.fx * W, a.fy * H, {
    type: a.type, color: NEON[a.c], size: a.size, rot: (i * 47) % 40 - 20, delay: 300 + i * 120, dur: 700, width: 4, cls: 'amb',
  }));
}

// rest position of the selected (top) bowl
function selectedRect(it) {
  const top = LAYOUT === 'halo' ? HALO_TOP : 1.18;
  return { x: CX, y: CY - geo[0].ry, w: it.w * top, h: it.h * top };
}
let doodledFor = null;
function drawSelection(it) {
  const r = selectedRect(it), d = byId[it.dish.id];
  const left = Math.max(46, r.x - r.w * 0.55);
  doodle(menuDoodles, r.x, r.y, { type: 'ring', color: NEON.green, size: Math.max(r.w, r.h) * 1.1, rot: Math.random() * 40 - 20, width: 5, dur: 650, cls: 'sel' });
  doodle(menuDoodles, left - 4, r.y + r.h * 0.36, { type: 'arrow', color: NEON.pink, size: 62, rot: -6, delay: 260, width: 5, cls: 'sel' });
  doodle(menuDoodles, Math.min(W - 30, r.x + r.w * 0.56), r.y + r.h * 0.28, { type: 'sparkle', color: NEON.teal, size: 32, delay: 380, width: 4, cls: 'sel' });
  doodle(menuDoodles, Math.min(W - 24, r.x + r.w * 0.5), r.y - r.h * 0.05, { type: 'sparkle', color: NEON.pink, size: 20, delay: 460, width: 3, cls: 'sel' });
  if (d.tag) doodle(menuDoodles, left + 6, r.y - r.h * 0.18, { type: 'word', text: d.tag || '', color: d.heat ? NEON.pink : NEON.green, size: 54, rot: -12, delay: 520, cls: 'selw' });
}

// one name readout for the bowl in focus, instead of a label on every plate
const focusEl = $('#focus');
let focused = null;
function setFocus(it) {
  if (!it || it.dish === focused) return;
  focused = it.dish;
  const d = byId[it.dish.id];
  focusEl.innerHTML = `<span class="f-no">${pad2(d.index + 1)}</span><span class="f-name">${d.name}</span>
    <span class="f-meta">${d.heat ? `<span class="heat-tag">${chilis(d.heat)}<span>${HEAT[d.heat]}</span></span>` : ''}<span class="f-price">${fmt(d.price)}</span></span>`;
  focusEl.classList.remove('swap'); void focusEl.offsetWidth; focusEl.classList.add('swap');
}
addEventListener('resize', () => { layout(); if (detail.current) placeHero(false); });

// motion state
let theta = 0, omega = 0;            // rotation (rad) and angular velocity (rad/s)
const pan = { x: 0, y: 0, tx: 0, ty: 0 }; // elastic lean while dragging
const drift = () => 0; // both layouts now settle on a selected bowl instead of drifting
let frozen = false;                  // true while a dish is open
let braking = false;

let last = performance.now();
function tick(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  if (!drag.active) {
    if (braking || frozen) omega *= Math.exp(-dt * 9);
    else if (Math.abs(omega) < 1.2) {
      // settle the nearest bowl at the top (critically damped spring)
      const target = Math.round(theta / STEP) * STEP;
      omega += ((target - theta) * 60 - omega * 15.5) * dt;
    } else omega += (drift() - omega) * (1 - Math.exp(-dt * 3.2));
    theta += omega * dt;
  }
  pan.x += (pan.tx - pan.x) * (1 - Math.exp(-dt * 10));
  pan.y += (pan.ty - pan.y) * (1 - Math.exp(-dt * 10));
  if (!frozen || pull.active) render(t);
  // doodle the selection once the ring has come to rest; wipe them as soon as it moves
  const settled = !drag.active && !frozen && !switching && Math.abs(omega) < 0.05 && Math.abs(theta - Math.round(theta / STEP) * STEP) < 0.01;
  if (settled && focused && doodledFor !== focused) {
    if (doodledFor !== null || drag.moved > 9) haptic(HAPTIC.select); // a bowl clicks into place (Android; iPhone allows haptics only during a tap)
    doodledFor = focused;
    clearDoodles(menuDoodles, '.sel, .selw');
    const it = items.find((i) => i.dish === focused);
    if (it) drawSelection(it);
  } else if (!settled && doodledFor && (drag.active || Math.abs(omega) > 0.25)) {
    doodledFor = null;
    clearDoodles(menuDoodles, '.sel, .selw');
  }
  requestAnimationFrame(tick);
}

function render(t) {
  let front = null;
  for (const it of items) {
    const ring = RINGS[it.ring], g = geo[it.ring];
    const a = it.a0 + theta * ring.speed + ring.phase;
    const fl = reduced ? 0 : Math.sin(t * 0.0011 + it.phase);
    let depth, sc;
    if (LAYOUT === 'wheel') {
      depth = -Math.sin(a);                       // 1 at the top of the wheel
      const f = Math.max(0, depth) ** 6;
      sc = 0.8 + 0.38 * f;
    } else {
      depth = -Math.sin(a);                       // 1 at the top (selected) … -1 at the bottom
      const down = (1 - depth) / 2;               // 0 top … 1 bottom
      sc = 0.95 - 0.22 * down + (HALO_TOP - 0.95) * Math.max(0, depth) ** 4;
    }
    it.depth = depth;
    it.x = CX + Math.cos(a) * g.rx + pan.x;
    it.y = CY + Math.sin(a) * g.ry + pan.y + fl * 4;
    it.sc = sc;
    it.rot = reduced ? 0 : Math.sin(t * 0.0007 + it.phase * 1.7) * 2 + Math.cos(a) * (LAYOUT === 'wheel' ? 10 : 3);
    const z = Math.round((depth + 1) * 50);
    if (z !== it.z) { it.z = z; it.el.style.zIndex = z; }
    // skip the style write when nothing visibly moved (saves style work every frame)
    const key = ((it.x * 2) | 0) + ',' + ((it.y * 2) | 0) + ',' + ((it.rot * 20) | 0) + ',' + ((it.sc * 500) | 0);
    if (!front || depth > front.depth) front = it;
    if (key === it.key) continue;
    it.key = key;
    it.el.style.transform = `translate3d(${(it.x - it.w / 2).toFixed(1)}px,${(it.y - it.h / 2).toFixed(1)}px,0) rotate(${it.rot.toFixed(2)}deg) scale(${it.sc.toFixed(3)})`;
  }
  setFocus(front);
}

// ─── Drag / tap ──────────────────────────────────────────
const drag = { active: false, id: 0, x: 0, y: 0, sx: 0, sy: 0, t0: 0, moved: 0, caught: false, samples: [] };

universe.addEventListener('pointerdown', (e) => {
  if (frozen || drag.active) return;
  if (e.button !== undefined && e.button !== 0) return;
  drag.active = true; drag.id = e.pointerId;
  drag.x = drag.sx = e.clientX; drag.y = drag.sy = e.clientY; drag.t0 = performance.now();
  drag.moved = 0; drag.caught = Math.abs(omega) > 0.6; // touching a spinning orbit only catches it
  drag.samples = [{ t: drag.t0, th: theta }];
  omega = 0;
  try { universe.setPointerCapture(e.pointerId); } catch {}
});

universe.addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY;
  drag.moved = Math.max(drag.moved, Math.hypot(drag.x - drag.sx, drag.y - drag.sy));
  if (drag.moved > 8) universe.classList.add('dragging');
  // grab-the-wheel mapping: tangential component of the drag around the ring's centre
  const rx = e.clientX - CX, ry = e.clientY - CY;
  const minR = LAYOUT === 'wheel' ? geo[0].rx * 0.7 : Math.min(W, H) * 0.32;
  const dth = (rx * dy - ry * dx) / Math.max(rx * rx + ry * ry, minR * minR);
  theta += dth;
  const now = performance.now();
  drag.samples.push({ t: now, th: theta });
  while (drag.samples.length > 2 && now - drag.samples[0].t > 90) drag.samples.shift();
  pan.tx = Math.max(-30, Math.min(30, (drag.x - drag.sx) * 0.08));
  pan.ty = Math.max(-30, Math.min(30, (drag.y - drag.sy) * 0.08));
});

function endDrag(e, cancelled) {
  if (!drag.active || e.pointerId !== drag.id) return;
  drag.active = false;
  universe.classList.remove('dragging');
  pan.tx = pan.ty = 0;
  const now = performance.now();
  const s0 = drag.samples[0];
  const dt = (now - s0.t) / 1000;
  omega = dt > 0.008 && now - drag.samples[drag.samples.length - 1].t < 80 ? (theta - s0.th) / dt : 0;
  omega = Math.max(-5, Math.min(5, omega));
  if (!cancelled && drag.moved < 9 && now - drag.t0 < 450 && !drag.caught) {
    omega = 0;
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) { hapticSoon(HAPTIC.select); go(`#${hit.dish.id}`, { source: hit }); }
  }
}
universe.addEventListener('pointerup', (e) => endDrag(e, false));
universe.addEventListener('pointercancel', (e) => endDrag(e, true));

function hitTest(x, y) {
  let best = null;
  for (const it of items) {
    const rw = it.w * it.sc * 0.44, rh = it.h * it.sc * 0.42;
    const nx = (x - it.x) / rw, ny = (y - it.y) / rh;
    if (nx * nx + ny * ny <= 1 && (!best || it.z > best.z)) best = it;
  }
  return best;
}

// keyboard (focus a bowl + Enter) and arrows / wheel spin
itemsEl.addEventListener('click', (e) => {
  if (e.detail !== 0) return; // pointer taps are handled above
  if (e.target.closest('.hz')) return; // the iPhone haptic switch's own click
  const el = e.target.closest('.dish');
  const it = items.find((i) => i.el === el);
  if (it) go(`#${it.dish.id}`, { source: it });
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (detail.current || sheetOpen)) { back(); return; }
  if (frozen || sheetOpen) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') omega = 1.6;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') omega = -1.6;
});
universe.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (frozen) return;
  const d = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
  omega = Math.max(-4, Math.min(4, omega * 0.6 + d * 0.012));
}, { passive: false });

// ═══ Dish detail ════════════════════════════════════════
const detailEl = $('#detail');
const dDoodles = $('#dDoodles');
const hero = $('#hero');
hero.style.position = 'fixed';
const chip = $('#modeChip');
const glitch = new Glitch(hero, {
  onMode: (m) => { chip.classList.toggle('is-anime', m === 'anime'); },
  onBurst: (dur) => { if (!detail.busy) hapticSoon(HAPTIC.glitch); dDoodles.classList.add('glitching'); clearTimeout(dDoodles._t); dDoodles._t = setTimeout(() => dDoodles.classList.remove('glitching'), dur); },
});
const detail = { current: null, source: null, qty: 1, rect: null, anim: null, busy: false };

function bestInstance(id) {
  // the most visible, front-most copy of that dish
  let best = null, bestScore = -1e9;
  for (const it of items) {
    if (it.dish.id !== id) continue;
    const onScreen = it.x > 0 && it.x < W && it.y > 0 && it.y < H;
    const score = (onScreen ? 1000 : 0) + it.z - Math.hypot(it.x - W / 2, it.y - H / 2) * 0.1;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return best;
}

function placeHero() {
  const d = detail.current;
  const st = $('.d-stage').getBoundingClientRect();
  const im = images[d.id].real;
  const ar = im.naturalHeight / im.naturalWidth;
  const maxW = Math.min(st.width * 0.86, 440);
  let w = Math.min(maxW, st.height / ar);
  w = Math.max(160, w);
  const h = w * ar;
  const left = st.left + (st.width - w) / 2, top = st.top + (st.height - h) / 2;
  hero.style.left = left + 'px'; hero.style.top = top + 'px';
  const hg = $('#heroGhost'); // invisible switch over the zoomed dish (iPhone tick on tap)
  Object.assign(hg.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px' });
  const hh = $('#heroHeat');
  hh.style.left = left + w * 0.52 + 'px'; hh.style.top = top - h * 0.04 + 'px'; hh.style.width = w * 0.58 + 'px';
  detail.rect = { left, top, w, h, cx: left + w / 2, cy: top + h / 2 };
  glitch.setDish(images[d.id], w, h, d.id);
  chip.classList.remove('is-anime');
}

function fromTransform(it) {
  const r = detail.rect;
  const s = (it.w * it.sc) / r.w;
  return `translate(${it.x - r.cx}px, ${it.y - r.cy}px) rotate(${it.rot}deg) scale(${s})`;
}

async function openDish(id, source) {
  await heroReady;
  const d = byId[id];
  if (!d) return replaceTo(MENU_URL());
  detail.current = d; detail.qty = 1; detail.busy = false;
  detail.source = source || bestInstance(id);
  frozen = true; braking = true;

  $('#dName').textContent = d.name;
  $('#dDesc').textContent = d.desc;
  $('#dPrice').textContent = fmt(d.price);
  $('#dJp').textContent = d.jp;
  $('#dIndex').innerHTML = `<b>${pad2(d.index + 1)}</b>/${pad2(MENU.length)}`;
  $('#dHeat').innerHTML = d.heat ? `<span class="heat-tag">${chilis(d.heat)}<span>${HEAT[d.heat]}</span></span>` : '';
  $('#heroHeat').innerHTML = d.heat ? chilis(d.heat) : '';
  $('#heroHeat').className = `heat-cluster hero-heat h${d.heat}`;
  hero.setAttribute('aria-label', `${d.name} artwork`);
  syncQty();
  const add = $('#addBtn'); add.classList.remove('done'); add.disabled = false; $('.add-label').textContent = 'ADD TO ORDER';

  app.classList.add('in-detail');
  detailEl.setAttribute('aria-hidden', 'false');
  detailEl.classList.remove('closing'); detailEl.classList.add('opening');
  placeHero();

  const src = detail.source;
  src && src.el.classList.add('hidden-for-hero');
  detail.anim?.cancel();
  detail.anim = hero.animate(
    reduced || !src
      ? [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }]
      : [{ transform: fromTransform(src) }, { transform: 'none' }],
    { duration: reduced ? 220 : 760, easing: 'cubic-bezier(.2,1.18,.32,1)', fill: 'both' }
  );
  setTimeout(() => { if (detail.current === d) { detailEl.classList.add('open'); detailEl.classList.remove('opening'); } }, reduced ? 0 : 140);
  glitch.start(reduced ? Infinity : 950);
  setTimeout(() => glitch.prepare(), reduced ? 0 : 780); // after the fly-in, never during it
  clearDoodles(dDoodles);
  setTimeout(() => { if (detail.current === d) drawDetailDoodles(d); }, reduced ? 0 : 420);
  setTimeout(() => $('#addBtn').focus({ preventScroll: true }), 400);
}

function closeDish() {
  const d = detail.current;
  if (!d) return;
  detail.current = null;
  detailEl.classList.remove('open', 'opening'); detailEl.classList.add('closing');
  detailEl.setAttribute('aria-hidden', 'true');
  app.classList.remove('in-detail');
  const src = detail.source;
  glitch.burstUntil = 0; glitch.setMode('real'); glitch.drawCalm(); glitch.stop();
  // if closed by a swipe-down, fly home from where the finger left the bowl
  const start = pullTransform();
  resetPull(false);
  clearDoodles(dDoodles);
  detail.anim?.cancel();
  detail.anim = hero.animate(
    reduced || !src
      ? [{ opacity: 1, transform: start }, { opacity: 0, transform: `${start} scale(.9)` }]
      : [{ transform: start }, { transform: fromTransform(src) }],
    { duration: reduced ? 200 : 560, easing: 'cubic-bezier(.55,0,.2,1)', fill: 'both' }
  );
  detail.anim.onfinish = () => {
    if (detail.current) return; // re-opened meanwhile
    src && src.el.classList.remove('hidden-for-hero');
    detailEl.classList.remove('closing');
    frozen = false; braking = false;
    src && src.el.focus({ preventScroll: true });
  };
}

function syncQty() {
  $('#qVal').textContent = detail.qty;
  $('#addTotal').textContent = fmt(detail.current.price * detail.qty);
  $('#qMinus').disabled = detail.qty <= 1;
}
$('#qMinus').onclick = () => { if (detail.qty > 1) { detail.qty--; syncQty(); haptic(HAPTIC.tick); } };
$('#qPlus').onclick = () => { if (detail.qty < 20) { detail.qty++; syncQty(); haptic(HAPTIC.tick); } };
chip.addEventListener('click', () => glitch.flip());

// ─── Swipe down to go back ───────────────────────────────
// Drag anywhere in the dish view (except its buttons): the bowl and info follow the finger and
// shrink; past a threshold (or a quick flick) the dish drops back into the menu, otherwise it springs back.
const dInfo = $('.d-info'), heroHeat = $('#heroHeat');
const pull = { active: false, id: 0, x0: 0, y0: 0, dy: 0, moved: 0, onHero: false, samples: [] };
const pullScale = (dy) => 1 - Math.min(dy / innerHeight, 0.5) * 0.5;
function pullTransform() {
  return pull.dy > 0 ? `translate(0px, ${pull.dy.toFixed(1)}px) scale(${pullScale(pull.dy).toFixed(3)})` : 'none';
}
function applyPull() {
  const dy = pull.dy, s = pullScale(dy);
  hero.style.translate = `0 ${dy}px`; hero.style.scale = s;
  heroHeat.style.translate = `0 ${dy}px`;
  dInfo.style.translate = `0 ${dy * 1.15}px`;
  dInfo.style.opacity = Math.max(0, 1 - dy / 220);
  $('#orbit').style.opacity = Math.min(1, 0.09 + dy / 420); // the menu starts to come back while pulling
}
function resetPull(animate) {
  const els = [hero, heroHeat, dInfo, $('#orbit')];
  if (animate) els.forEach((el) => (el.style.transition = 'translate .45s cubic-bezier(.2,1.3,.4,1), scale .45s cubic-bezier(.2,1.3,.4,1), opacity .3s'));
  hero.style.translate = hero.style.scale = heroHeat.style.translate = dInfo.style.translate = dInfo.style.opacity = '';
  $('#orbit').style.opacity = '';
  pull.dy = 0;
  if (animate) setTimeout(() => els.forEach((el) => (el.style.transition = '')), 460);
}

detailEl.addEventListener('pointerdown', (e) => {
  if (!detail.current || detail.busy || pull.active) return;
  if (e.button !== undefined && e.button !== 0) return;
  if (e.target.closest('button, input, output, .stepper') && !e.target.closest('#heroGhost')) return;
  pull.active = true; pull.id = e.pointerId; pull.x0 = e.clientX; pull.y0 = e.clientY;
  pull.dy = 0; pull.moved = 0; pull.onHero = e.target === hero || !!e.target.closest('#heroGhost');
  pull.samples = [{ t: performance.now(), y: e.clientY }];
  try { detailEl.setPointerCapture(e.pointerId); } catch {}
});
detailEl.addEventListener('pointermove', (e) => {
  if (!pull.active || e.pointerId !== pull.id) return;
  const dx = e.clientX - pull.x0, raw = e.clientY - pull.y0;
  pull.moved = Math.max(pull.moved, Math.hypot(dx, raw));
  pull.dy = raw > 0 ? raw : 0;
  const now = performance.now();
  pull.samples.push({ t: now, y: e.clientY });
  while (pull.samples.length > 2 && now - pull.samples[0].t > 100) pull.samples.shift();
  if (pull.moved > 6) applyPull();
});
function endPull(e, cancelled) {
  if (!pull.active || e.pointerId !== pull.id) return;
  pull.active = false;
  const s0 = pull.samples[0], now = performance.now();
  const v = (e.clientY - s0.y) / Math.max(1, now - s0.t); // px per ms
  if (!cancelled && pull.moved < 8) {           // a tap, not a drag
    if (pull.onHero) glitch.flip();
    return;
  }
  if (!cancelled && (pull.dy > 130 || (pull.dy > 40 && v > 0.55))) { hapticSoon(HAPTIC.select); back(); }
  else resetPull(true);
}
detailEl.addEventListener('pointerup', (e) => endPull(e, false));
detailEl.addEventListener('pointercancel', (e) => endPull(e, true));
$('#dClose').onclick = () => back();

$('#addBtn').onclick = () => {
  if (detail.busy || !detail.current) return;
  detail.busy = true;
  haptic(HAPTIC.add);
  const d = detail.current;
  cart.set(d.id, Math.min(99, (cart.get(d.id) || 0) + detail.qty));
  saveCart();
  const btn = $('#addBtn');
  btn.classList.add('done'); btn.disabled = true;
  $('.add-label').textContent = `ADDED ✓  ×${detail.qty}`;
  if (!reduced) {
    hero.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.09) rotate(-2deg)' }, { transform: 'scale(.96) rotate(1deg)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'ease-out', composite: 'add' }
    );
    glitch.burst(performance.now(), 180, 'real');
  }
  const br = btn.getBoundingClientRect();
  burst($('#fx'), br.left + br.width / 2, br.top + 8, 14);
  setTimeout(() => { updateFab(true); if (detail.current === d) back(); }, reduced ? 350 : 750);
};

// ═══ Order sheet ════════════════════════════════════════
const sheetEl = $('#sheet');
const inner = $('#sheetInner');
let sheetOpen = false;
const info = { method: null, table: params.get('table') || '', tableFromQR: !!params.get('table'), address: '', phone: '', notes: '' };
let lastOrder = null;

fab.onclick = () => { haptic(HAPTIC.tick); go('#order'); };

const STEPS = { cart: 'YOUR ORDER', method: 'HOW', details: 'DETAILS', review: 'REVIEW', done: 'CONFIRMED' };
const ICON_BACK = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4"/></svg>';

function lineThumb(id) { return `<img src="${img(id, 'real')}" alt="">`; }

function renderSheet(step) {
  const n = cartCount();
  if (step !== 'done' && n === 0) step = 'cart';
  if ((step === 'details' || step === 'review') && !info.method) step = 'method';
  const stepNo = { cart: 1, method: 2, details: 3, review: 4, done: 5 }[step];
  const head = `
    <div class="s-head">
      ${step === 'cart' || step === 'done' ? '<span></span>' : `<button class="s-back" data-act="back" aria-label="Back">${ICON_BACK}</button>`}
      <span class="s-step">${step === 'done' ? '' : `STEP ${stepNo}/4 · `}${STEPS[step]}</span>
      <button class="s-x" data-act="${step === 'done' ? 'finish' : 'close'}" aria-label="Close">${ICON_X}</button>
    </div>`;
  let title = '', body = '', foot = '';

  if (step === 'cart') {
    title = `My <em>orders</em>`;
    body = n === 0
      ? `<div class="empty">NOTHING HERE YET.<br>SPIN THE UNIVERSE, TAP A BOWL.</div>`
      : [...cart].map(([id, q]) => {
          const d = byId[id];
          return `<div class="line">${lineThumb(id)}
            <div><h3>${d.name}</h3><div class="unit">${fmt(d.price)} each</div>${d.heat ? `<span class="heat-tag">${chilis(d.heat)}<span>${HEAT[d.heat]}</span></span>` : ''}</div>
            <div class="right"><span class="sum">${fmt(d.price * q)}</span>
              <div class="stepper small" role="group" aria-label="${d.name} quantity">
                <button data-act="dec" data-id="${id}" aria-label="One less">−</button><output>${q}</output><button data-act="inc" data-id="${id}" aria-label="One more">+</button>
              </div>
              <button class="rm" data-act="rm" data-id="${id}">REMOVE</button>
            </div></div>`;
        }).join('') + `<div class="totals"><div class="grand"><span>Subtotal</span><span>${fmt(subtotal())}</span></div></div>`;
    foot = n === 0 ? `<button class="add" data-act="close">BACK TO THE BOWLS</button>`
                   : `<button class="add" data-act="next" data-to="method"><span>CONTINUE</span><span class="add-total">${fmt(subtotal())}</span></button>`;
  }

  if (step === 'method') {
    title = `Eat <em>where?</em>`;
    body = `<div class="methods">
      <button class="method" data-act="method" data-m="dine"><span class="big">Dine in</span><span class="jp">店内</span><span class="sub">Eat here. We bring it to your table.</span></button>
      <button class="method" data-act="method" data-m="delivery"><span class="big">Delivery</span><span class="jp">配達</span><span class="sub">To your door. ${fmt(DELIVERY_FEE)} delivery fee.</span></button>
    </div>`;
  }

  if (step === 'details') {
    if (info.method === 'dine') {
      title = `Your <em>table</em>`;
      body = `
        ${info.tableFromQR ? `<p><span class="tag red">FROM QR CODE</span></p>` : ''}
        <label class="field table-big" data-f="table"><span>TABLE NUMBER</span>
          <input id="fTable" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="00" value="${esc(info.table)}" autocomplete="off">
          <div class="msg">Enter the number on your table.</div></label>
        <p class="note">Scanning the QR code on your table fills this in automatically (e.g. <b>?table=12</b>).</p>`;
    } else {
      title = `Where <em>to?</em>`;
      body = `
        <label class="field" data-f="address"><span>DELIVERY ADDRESS</span>
          <textarea id="fAddress" rows="2" placeholder="Street, building, floor, apartment" autocomplete="street-address">${esc(info.address)}</textarea>
          <div class="msg">We need an address to deliver to.</div></label>
        <label class="field" data-f="phone"><span>CONTACT NUMBER</span>
          <input id="fPhone" type="tel" inputmode="tel" placeholder="+20 10 0000 0000" value="${esc(info.phone)}" autocomplete="tel">
          <div class="msg">Enter a phone number we can call.</div></label>
        <label class="field" data-f="notes"><span>INSTRUCTIONS <i>(optional)</i></span>
          <textarea id="fNotes" rows="2" placeholder="Gate code, leave at door, extra chili…">${esc(info.notes)}</textarea></label>`;
    }
    foot = `<button class="add" data-act="details-next"><span>REVIEW ORDER</span></button>`;
  }

  if (step === 'review') {
    const fee = info.method === 'delivery' ? DELIVERY_FEE : 0;
    title = `Check <em>it</em>`;
    body = `
      <div class="review-block"><h4>${info.method === 'dine' ? 'DINE IN' : 'DELIVERY'}</h4>
        <p>${info.method === 'dine' ? `Table ${esc(info.table)}` : `${esc(info.address)}<br>${esc(info.phone)}${info.notes ? `<br><span class="note">“${esc(info.notes)}”</span>` : ''}`}</p></div>
      <div class="review-block"><h4>BOWLS</h4>
        ${[...cart].map(([id, q]) => `<div class="mini-line"><span>${q} × ${byId[id].name}</span><span>${fmt(byId[id].price * q)}</span></div>`).join('')}</div>
      <div class="totals">
        <div><span>Subtotal</span><span>${fmt(subtotal())}</span></div>
        ${fee ? `<div><span>Delivery fee</span><span>${fmt(fee)}</span></div>` : ''}
        <div class="grand"><span>Total</span><span>${fmt(subtotal() + fee)}</span></div>
      </div>
      <p class="note">Prototype: placing the order is simulated. No payment is taken and nothing is sent to a kitchen.</p>`;
    foot = `<button class="add" data-act="place"><span>PLACE ORDER</span><span class="add-total">${fmt(subtotal() + fee)}</span></button>`;
  }

  if (step === 'done') {
    const o = lastOrder;
    if (!o) return renderSheet('cart');
    title = '';
    body = `<div class="done-hero">
        <div class="s-step">ORDER NUMBER</div>
        <div class="no">${o.no}</div>
        <div class="done-bowls">${o.lines.map(([id], i) => `<img src="${img(id, 'anime')}" alt="" style="animation-delay:${i * 80}ms">`).join('')}</div>
        <span class="tag stamp">${o.method === 'dine' ? `DINE IN · TABLE ${esc(o.table)}` : 'DELIVERY'}</span>
      </div>
      <div class="review-block">${o.lines.map(([id, q]) => `<div class="mini-line"><span>${q} × ${byId[id].name}</span><span>${fmt(byId[id].price * q)}</span></div>`).join('')}
        ${o.fee ? `<div class="mini-line"><span>Delivery fee</span><span>${fmt(o.fee)}</span></div>` : ''}
        <div class="mini-line"><b>Total</b><b>${fmt(o.total)}</b></div></div>
      ${o.method === 'delivery' ? `<div class="review-block"><h4>DELIVERING TO</h4><p>${esc(o.address)}</p></div>` : ''}
      <p class="note">This is a front-end prototype — the order was simulated, not sent to a real kitchen, and no payment was taken.</p>`;
    foot = `<button class="add" data-act="finish"><span>BACK TO THE BOWLS</span></button>`;
  }

  inner.innerHTML = `${head}${title ? `<h2 class="s-title">${title}</h2>` : ''}<div class="s-body">${body}</div>${foot ? `<div class="s-foot">${foot}</div>` : ''}`;
  inner.dataset.step = step;
  addTouchSwitches(inner, 'button');
  if (step === 'done') setTimeout(doodleDone, 250);
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function readDetails() {
  const ok = (sel, test) => { const f = inner.querySelector(sel); const good = test(); f.classList.toggle('err', !good); return good; };
  if (info.method === 'dine') {
    info.table = ($('#fTable')?.value || '').trim();
    return ok('[data-f=table]', () => /^\d{1,3}$/.test(info.table) && +info.table > 0);
  }
  info.address = ($('#fAddress')?.value || '').trim();
  info.phone = ($('#fPhone')?.value || '').trim();
  info.notes = ($('#fNotes')?.value || '').trim();
  const a = ok('[data-f=address]', () => info.address.length >= 6);
  const p = ok('[data-f=phone]', () => /^\+?[\d\s()-]{7,}$/.test(info.phone));
  return a && p;
}

inner.addEventListener('input', (e) => {
  if (e.target.id === 'fTable') info.table = e.target.value.replace(/\D/g, '').slice(0, 3), e.target.value = info.table;
  if (e.target.id === 'fAddress') info.address = e.target.value;
  if (e.target.id === 'fPhone') info.phone = e.target.value;
  if (e.target.id === 'fNotes') info.notes = e.target.value;
  e.target.closest('.field')?.classList.remove('err');
});

inner.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'back': back(); break;
    case 'close': back(); break;
    case 'inc': haptic(HAPTIC.tick); cart.set(id, Math.min(99, cart.get(id) + 1)); saveCart(); updateFab(); renderSheet('cart'); break;
    case 'dec': haptic(HAPTIC.tick); if (cart.get(id) > 1) cart.set(id, cart.get(id) - 1); else cart.delete(id); saveCart(); updateFab(); renderSheet('cart'); break;
    case 'rm': cart.delete(id); saveCart(); updateFab(); renderSheet('cart'); toast(`${byId[id].name.toUpperCase()} REMOVED`); break;
    case 'next': go(`#order-${b.dataset.to}`); break;
    case 'method': haptic(HAPTIC.tick); info.method = b.dataset.m; go('#order-details'); break;
    case 'details-next': if (readDetails()) go('#order-review'); else inner.querySelector('.err input, .err textarea')?.focus(); break;
    case 'place': placeOrder(); break;
    case 'finish': finish(); break;
  }
});

function placeOrder() {
  haptic(HAPTIC.order);
  const fee = info.method === 'delivery' ? DELIVERY_FEE : 0;
  lastOrder = {
    no: `${BRAND.orderPrefix}-${Math.floor(1000 + Math.random() * 9000)}`,
    method: info.method, table: info.table, address: info.address,
    lines: [...cart], fee, total: subtotal() + fee,
  };
  cart.clear(); saveCart(); updateFab();
  history.replaceState({ d: depth() }, '', '#order-done');
  route();
}

function finish() {
  // rewind the in-app history back to the menu entry
  const d = depth();
  if (d > 0) history.go(-d); else replaceTo(MENU_URL());
}

function openSheet(step) {
  sheetOpen = true; frozen = true;
  renderSheet(step);
  app.classList.add('in-sheet');
  sheetEl.classList.add('open');
  sheetEl.setAttribute('aria-hidden', 'false');
  inner.querySelector('.s-body')?.scrollTo(0, 0);
  setTimeout(() => inner.querySelector('input, textarea, .method, .add')?.focus({ preventScroll: true }), 350);
}
function closeSheet() {
  if (!sheetOpen) return;
  sheetOpen = false; frozen = false;
  app.classList.remove('in-sheet');
  sheetEl.classList.remove('open');
  sheetEl.setAttribute('aria-hidden', 'true');
  fab.focus({ preventScroll: true });
}

let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600);
}

// ═══ Router (real browser history, back button works) ═══
const depth = () => history.state?.d || 0;
let navCtx = null;
function go(hash, ctx) { navCtx = ctx || null; history.pushState({ d: depth() + 1 }, '', hash); route(); }
// Routes are plain #names (#spicy-ramen, #order, #order-method …, #table-12) so they survive any host.
const MENU_URL = () => location.pathname + location.search;
function back() { if (depth() > 0) history.back(); else replaceTo(MENU_URL()); }
function replaceTo(url) { history.replaceState({ d: 0 }, '', url); route(); }
addEventListener('popstate', () => { navCtx = null; route(); });

function route() {
  const h = location.hash.slice(1);
  const ctx = navCtx; navCtx = null;
  const table = /^table-(\d{1,3})$/.exec(h); // dine-in QR codes link to #table-12
  if (table) { info.table = table[1]; info.tableFromQR = true; replaceTo(MENU_URL()); return; }
  if (h === 'buzz') { showBuzzTest(); return; }
  if (byId[h]) {
    if (sheetOpen) closeSheet();
    if (detail.current?.id !== h) { if (detail.current) closeDish(); openDish(h, ctx?.source); }
    return;
  }
  if (detail.current) closeDish();
  if (h === 'order' || h.startsWith('order-')) {
    const b = h.slice(6);
    const step = ['method', 'details', 'review', 'done'].includes(b) ? b : 'cart';
    if (!sheetOpen) openSheet(step); else { renderSheet(step); inner.querySelector('.s-body')?.scrollTo(0, 0); }
    return;
  }
  closeSheet();
}

// A drag that starts at the right screen edge must spin the bowls, not trigger the browser's
// forward-swipe (which slides the last closed page back in from right to left).
// Our own drag/tap logic runs on pointer events, so cancelling the touch here costs nothing.
universe.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (t && t.clientX > innerWidth - 32) e.preventDefault();
}, { passive: false });
universe.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// bowls hang off-screen on purpose; never let focus or a browser quirk scroll the stage sideways
for (const el of [app, universe, $('#orbit'), itemsEl]) el.addEventListener('scroll', () => { el.scrollLeft = 0; el.scrollTop = 0; });

// ─── Boot ────────────────────────────────────────────────
history.replaceState({ d: 0 }, '', location.href);
menuReady.then(() => {
  layout();
  render(performance.now()); // positions exist before a deep-linked dish looks for its source bowl
  requestAnimationFrame((t) => { last = t; tick(t); });
  route();
});

// ─── Doodles in the dish view and on the confirmation ────
function drawDetailDoodles(d) {
  const r = detail.rect;
  if (!r) return;
  const sz = Math.max(r.w, r.h);
  doodle(dDoodles, r.cx, r.cy, { type: 'ring', color: NEON.green, size: sz * 1.12, rot: Math.random() * 30 - 15, width: 6, dur: 700 });
  doodle(dDoodles, r.left + r.w * 0.04, r.top + r.h * 0.1, { type: 'star', color: NEON.pink, size: 42, rot: -14, delay: 200, width: 4 });
  doodle(dDoodles, r.left + r.w * 0.14, r.top - r.h * 0.02, { type: 'sparkle', color: NEON.teal, size: 24, delay: 300, width: 3 });
  doodle(dDoodles, r.left + r.w * 1.0, r.top + r.h * 0.62, { type: 'sparkle', color: NEON.teal, size: 36, delay: 360, width: 4 });
  doodle(dDoodles, r.left - 2, r.top + r.h * 0.84, { type: 'arrow', color: NEON.teal, size: 58, rot: 4, delay: 420, width: 5 });
  doodle(dDoodles, r.left + r.w * 0.86, r.top + r.h * 0.97, { type: 'zigzag', color: NEON.pink, size: 54, rot: -8, delay: 480, width: 4 });
  if (d.tag) doodle(dDoodles, r.left + r.w * 0.2, r.top + r.h * 0.96, { type: 'word', text: d.tag || '', color: d.heat ? NEON.pink : NEON.green, size: 64, rot: -10, delay: 560 });
}

function doodleDone() {
  const host = inner.querySelector('.done-hero'), no = host?.querySelector('.no');
  if (!host || !no) return;
  const hr = host.getBoundingClientRect(), nr = no.getBoundingClientRect();
  const cx = nr.left - hr.left + nr.width / 2, by = nr.bottom - hr.top;
  doodle(host, cx, by + 4, { type: 'squiggle', color: NEON.green, size: Math.min(nr.width, 260), width: 6, dur: 600 });
  doodle(host, nr.left - hr.left - 8, nr.top - hr.top + 10, { type: 'star', color: NEON.pink, size: 34, rot: -12, delay: 250, width: 4 });
  doodle(host, nr.right - hr.left + 8, nr.top - hr.top + 6, { type: 'sparkle', color: NEON.teal, size: 30, delay: 350, width: 4 });
  doodle(host, nr.right - hr.left + 2, by - 6, { type: 'heart', color: NEON.pink, size: 26, rot: 12, delay: 450, width: 3 });
  burst($('#fx'), innerWidth / 2, nr.top + nr.height / 2, 16);
}

// ─── #buzz: which haptic method does this phone allow? ───
// 1 = a visible native switch (the system always ticks when a finger flips one)
// 2 = an invisible native switch laid over a button, so the finger flips it without seeing it
// 3 = the script-only trick (clicking a hidden switch from code)
function showBuzzTest() {
  if ($('#buzzTest')) return;
  const el = document.createElement('div');
  el.id = 'buzzTest';
  el.innerHTML = `
    <p class="note" style="margin:0">iOS ${(/OS (\d+)_(\d+)/.exec(navigator.userAgent) || []).slice(1).join('.') || '?'} · method: <b>${hapticInfo()}</b></p>
    <label class="bz-row">1 · Flip this switch <input type="checkbox" switch id="bz1"></label>
    <div class="bz-wrap"><button class="add" tabindex="-1"><span>2 · TAP THIS BUTTON</span></button><label class="bz-ghost"><input type="checkbox" switch id="bz2"></label></div>
    <button class="add" id="bz3" style="background:var(--ink)"><span>3 · SCRIPT TRICK</span></button>
    <p class="note" style="margin:0">Tell me which numbers you felt.</p>
    <button class="rm" id="buzzClose">CLOSE</button>`;
  el.style.cssText = 'position:absolute;z-index:80;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 24px);background:var(--paper);border:1.5px solid var(--ink);border-radius:22px;padding:16px;display:grid;gap:12px;justify-items:stretch;text-align:center;touch-action:manipulation';
  app.appendChild(el);
  $('#bz2').addEventListener('change', () => toast('2 TAPPED'));
  $('#bz3').onclick = () => { haptic(HAPTIC.test); toast('3 SENT'); };
  $('#buzzClose').onclick = () => { el.remove(); replaceTo(MENU_URL()); };
}

// iPhone haptics: invisible switches under the fixed controls
addTouchSwitches(document, '#addBtn, #qMinus, #qPlus, #modeChip, #fab, #dClose, #layoutSwitch button');
addTouchSwitch($('#heroGhost'));
