// Phone haptics without any permission prompt.
// Android (Chrome, Samsung Internet, Firefox): the Vibration API, after the visitor has touched the page once.
// iPhone: Safari has no Vibration API. On iOS 18+, toggling a native <input type="checkbox" switch>
// plays the system's switch haptic, and clicking its <label> from script counts — but only while
// a real tap is being handled. Outside a tap it silently does nothing, and Apple may close this
// in any update; everything here fails quietly.
const canVibrate = typeof navigator.vibrate === 'function';
let label = null;

function iosSwitch() {
  if (label) return label;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  // inside the viewport (so focusing it can't scroll anything) but invisible and untouchable
  label.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;z-index:-1';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

/**
 * pattern: ms of vibration, or [buzz, pause, buzz, …] (Android).
 * iPhone always gets one light tick, and only when called during a tap.
 */
export function haptic(pattern = 10) {
  try {
    if (canVibrate) { navigator.vibrate(pattern); return; }
    const l = iosSwitch();
    l.click();
    l.firstChild.blur();
  } catch { /* no haptics on this device */ }
}

export const HAPTIC = {
  tick: 8,                        // small UI taps
  select: 12,                     // a bowl opens / settles at the top
  glitch: [5, 35, 7, 25, 4],      // jittery, matches a glitch burst
  add: [18, 45, 30],              // added to order
  order: [25, 60, 25, 60, 50],    // order placed
};
