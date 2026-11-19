// ─── Editable content ────────────────────────────────────────────────────────
// Brand: change `name` to "OTTAQU" (or open the site with ?brand=OTTAQU).
const params = new URLSearchParams(location.search);

export const BRAND = {
  name: (params.get('brand') || 'DUQAIO').toUpperCase(),
  jp: '麺の宇宙',            // "noodle universe" — small editorial detail
  orderPrefix: 'DQ',
};

export const MONEY = { currency: 'EGP', locale: 'en-EG', decimals: 0 };
export const DELIVERY_FEE = 35;

// Images live in assets/dishes/<id>_{real,anime,menu,shadow}.webp
export const MENU = [
  {
    id: 'spicy-ramen',
    tag: '',                 // marker-word doodle (empty = none)
    name: 'Spicy Ramen',
    jp: '辛ラーメン',
    desc: 'Chili-red tonkotsu, minced pork, ajitama egg, scallion and a crown of chili threads.',
    price: 345,
    heat: 3,
  },
  {
    id: 'shrimp-noodles',
    tag: 'FRESH!',            // marker-word doodle
    name: 'Shrimp Noodles',
    jp: '海老麺',
    desc: 'Thin wheat noodles in a clear yuzu-garlic broth, seared shrimp, lemon and micro greens.',
    price: 395,
    heat: 1,
  },
  {
    id: 'black-garlic-ramen',
    tag: 'UMAMI',            // marker-word doodle
    name: 'Black Garlic Ramen',
    jp: '黒マー油',
    desc: 'Rich miso broth, roasted black garlic oil, chashu, ajitama, nori and wood-ear mushroom.',
    price: 365,
    heat: 0,
  },
  {
    id: 'sesame-dan-dan',
    tag: 'NUTTY!',            // marker-word doodle
    name: 'Sesame Dan Dan',
    jp: '担担麺',
    desc: 'Creamy sesame chili broth, Sichuan pepper, crisp pork, peanuts and baby bok choy.',
    price: 325,
    heat: 2,
  },
  {
    id: 'mushroom-udon',
    tag: 'COZY',            // marker-word doodle
    name: 'Mushroom Udon',
    jp: 'きのこうどん',
    desc: 'Thick udon in a dashi-butter glaze with shiitake, king oyster mushroom and sesame.',
    price: 295,
    heat: 0,
  },
];
