// Phone haptics without any permission prompt.
// Android (Chrome, Samsung Internet, Firefox): the Vibration API, after the visitor has touched the page once.
//   Pulses under ~20 ms are too short for most phone motors to be felt, so every pulse here is 25 ms+.
// iPhone: Safari has no Vibration API. On iOS 18+, toggling a native <input type="checkbox" switch>
//   plays the system switch haptic. The known-working recipe: a fresh hidden <label><input switch></label>,
//   click the label during a real tap, remove it. Outside a tap it silently does nothing, and Apple may
//   close this in any update; everything here fails quietly.
const canVibrate = typeof navigator.vibrate === 'function';
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function iosTick() {
  const label = document.createElement('label');
  label.ariaHidden = 'true';
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

/**
 * pattern: ms of vibration, or [buzz, pause, buzz, …] (Android).
 * iPhone gets one tick per call (two for a pattern with several buzzes), only during a tap.
 */
export function haptic(pattern = 30) {
  try {
    if (canVibrate && !isIOS) { navigator.vibrate(pattern); return; }
    iosTick();
    if (Array.isArray(pattern) && pattern.length > 2) setTimeout(() => { try { iosTick(); } catch {} }, 90);
  } catch { /* no haptics on this device */ }
}

export const HAPTIC = {
  tick: 25,                          // small UI taps
  select: 35,                        // a bowl opens / settles at the top
  glitch: [25, 40, 30, 35, 25],      // jittery, matches a glitch burst
  add: [40, 60, 70],                 // added to order
  order: [50, 80, 50, 80, 120],      // order placed
  test: [80, 80, 80, 80, 160],       // the test button
};

export const hapticInfo = () => (canVibrate && !isIOS ? 'vibration' : isIOS ? 'ios-switch' : 'none');

// On iPhone the switch trick is safest inside a 'click'. Haptics requested from pointerup/touchend
// handlers wait for the click that the same tap produces (within 400 ms); elsewhere they fire at once.
let pending = null, pendingT = 0;
export function hapticSoon(pattern) {
  if (canVibrate && !isIOS) { haptic(pattern); return; }
  pending = pattern; clearTimeout(pendingT);
  pendingT = setTimeout(() => { pending = null; }, 400);
}
document.addEventListener('click', () => {
  if (pending === null) return;
  const p = pending; pending = null;
  haptic(p);
}, true);
