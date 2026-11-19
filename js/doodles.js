// Neon graffiti doodles: hand-drawn strokes that draw themselves on, with a light "line boil"
// wobble. Original shapes; colours are the teal / pink / neon-green set.
export const NEON = { teal: '#00D1C1', pink: '#FF2D95', green: '#6BFF1F' };
const INK = '#0E0D0C';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 100×100 hand-drawn paths
const SHAPES = {
  ring: 'M14 54 C 10 26, 44 9, 70 16 C 93 24, 97 62, 73 81 C 50 97, 13 86, 11 58 C 9 37, 31 21, 57 19 C 77 18, 89 30, 91 41',
  arrow: 'M8 86 C 22 74, 30 52, 52 42 C 64 37, 76 31, 88 16 M70 13 L89 15 L87 34',
  star: 'M50 7 L60 37 L93 39 L67 58 L77 91 L50 71 L23 91 L33 58 L7 39 L40 37 Z',
  sparkle: 'M50 4 C 52 34, 64 47, 96 50 C 64 53, 52 66, 50 96 C 48 66, 36 53, 4 50 C 36 47, 48 34, 50 4 Z',
  zigzag: 'M4 62 L19 36 L33 64 L48 35 L63 64 L78 35 L96 60',
  spiral: 'M50 50 C 50 43, 59 43, 59 50 C 59 61, 41 61, 41 50 C 41 35, 67 35, 67 50 C 67 69, 33 69, 33 50 C 33 27, 77 27, 77 50 C 77 77, 24 77, 23 50',
  heart: 'M50 86 C 20 66, 7 45, 21 28 C 33 14, 48 23, 50 34 C 52 23, 67 14, 79 28 C 93 45, 80 66, 50 86 Z',
  cross: 'M24 22 L78 80 M78 22 L24 80',
  rays: 'M50 4 L50 24 M50 76 L50 96 M4 50 L24 50 M76 50 L96 50 M17 17 L31 31 M69 69 L83 83 M83 17 L69 31 M17 83 L31 69',
  squiggle: 'M4 56 C 14 38, 25 72, 36 54 C 46 37, 56 72, 67 54 C 77 37, 87 72, 96 52',
  face: 'M50 10 C 74 10, 90 28, 90 50 C 90 74, 72 90, 50 90 C 26 90, 10 72, 10 50 C 10 27, 28 10, 52 10 M33 36 L45 48 M45 36 L33 48 M56 36 L68 48 M68 36 L56 48 M32 66 C 42 76, 60 76, 70 62',
};
const FILLED = new Set(['star', 'heart', 'sparkle']);

// (line boil is a CSS jitter now — an SVG displacement filter was too slow on phones)
let boilStarted = true;
function ensureBoil() {
  if (boilStarted || reduced) return;
  boilStarted = true;
  const turb = document.querySelector('#boil feTurbulence');
  if (!turb) return;
  let s = 1;
  setInterval(() => { s = (s % 4) + 1; turb.setAttribute('seed', s); }, 120); // hand-drawn "boil"
}

/**
 * Draw one doodle into `parent`, centred on (x, y) in the parent's px.
 * opts: type, color, size, rot, delay (ms), dur (ms), width (stroke), cls, text (for type 'word')
 */
export function doodle(parent, x, y, opts = {}) {
  ensureBoil();
  const { type = 'star', color = NEON.pink, size = 60, rot = 0, delay = 0, dur = 520, width = 6, cls = '', text = '' } = opts;
  const el = document.createElement('div');
  el.className = `doodle ${cls}`;
  el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;transform:rotate(${rot}deg);--d:${delay}ms;--t:${dur}ms;--c:${color}`;
  if (type === 'word') {
    el.classList.add('doodle-word');
    el.style.height = 'auto'; el.style.width = 'auto'; el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.transform = `translate(-50%,-50%) rotate(${rot}deg)`;
    el.style.fontSize = size * 0.42 + 'px';
    el.textContent = text;
  } else {
    const d = SHAPES[type] || SHAPES.star;
    const w = (width * 100) / size; // keep stroke width in px regardless of size
    el.innerHTML = `<svg viewBox="-8 -8 116 116" aria-hidden="true">
      <path class="ink" d="${d}" pathLength="1" stroke-width="${w + 5 * 100 / size}" />
      <path class="col${FILLED.has(type) ? ' filled' : ''}" d="${d}" pathLength="1" stroke-width="${w}" />
    </svg>`;
  }
  parent.appendChild(el);
  return el;
}

export function clearDoodles(parent, selector = '.doodle') {
  parent.querySelectorAll(selector).forEach((el) => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  });
}

const BURST_TYPES = ['star', 'sparkle', 'heart', 'zigzag', 'spiral', 'cross'];
const COLORS = [NEON.teal, NEON.pink, NEON.green];

/** Confetti of doodles flying out from (x, y) in viewport px. */
export function burst(layer, x, y, n = 12) {
  if (reduced) return;
  for (let i = 0; i < n; i++) {
    const size = 22 + Math.random() * 18;
    const el = doodle(layer, x, y, {
      type: BURST_TYPES[i % BURST_TYPES.length], color: COLORS[i % 3], size,
      rot: Math.random() * 360, dur: 260, width: 4,
    });
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
    const dist = 90 + Math.random() * 130;
    el.animate([
      { translate: '0 0', scale: 0.4, opacity: 1 },
      { translate: `${Math.cos(ang) * dist}px ${Math.sin(ang) * dist}px`, scale: 1.1, opacity: 1, offset: 0.7 },
      { translate: `${Math.cos(ang) * dist * 1.15}px ${Math.sin(ang) * dist * 1.15 + 40}px`, scale: 0.9, opacity: 0 },
    ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' })
      .onfinish = () => el.remove();
  }
}
