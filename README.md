# DUQAIO — Noodle Universe (front-end prototype)

**Live:** https://ahmedsalahadmin.github.io/duqaio/ (GitHub Pages from `main`; every push to `main` updates it in a minute or two)

Static site, no build step: `index.html`, `styles.css`, `js/`, `assets/`.
It can go up as-is on any static host (Netlify, Vercel, GitHub Pages, S3).

## Run locally
```
py -3.11 -m http.server 5180 --directory D:/Projects/duqaio
```
Then open http://localhost:5180 (phone on the same Wi-Fi: http://<this-PC-IP>:5180, with `--bind 0.0.0.0`).

## Edit content
- **Menu, prices, descriptions, currency, delivery fee:** `js/data.js`
- **Brand:** `BRAND.name` in `js/data.js` (`DUQAIO` → `OTTAQU`), or preview it live with `?brand=OTTAQU`
- **Dine-in QR codes:** point each table's QR at `<site link>#table-12`; the table number pre-fills

## Links (browser back button works through all of them)
- `#<dish-id>` (e.g. `#spicy-ramen`): opens that dish
- `#order` → `#order-method` → `#order-details` → `#order-review` → `#order-done`
- `#table-12`: dine-in table from a QR code
- `?layout=a` / `?layout=b` picks halo or wheel locally; the on-screen switch remembers the choice per device

## Live version
Published as a private claude.ai Artifact: https://claude.ai/artifact/SMZgQgy637EDKuLXfwsLz6
(share it from the page's Share menu). To republish after edits:
```
py -3.11 tools/build_artifact.py <out_dir>
```
then publish `<out_dir>/duqaio.html` with the 20 images under `assets/dishes/` to the same artifact URL.

## Assets
`tools/prep_assets.py` takes the raw realistic/anime PNG pairs, removes fragments of neighbouring
stickers, registers each anime image onto its realistic twin (so the glitch swaps in place), and
writes aligned WebPs plus a baked shadow into `assets/dishes/`. To add a dish: add its two PNGs,
add it to `DISHES` in the script and to `MENU` in `js/data.js`, then rerun:
```
py -3.11 tools/prep_assets.py _incoming_assets assets/dishes
```
Needs Pillow + numpy.

## Out of scope (simulated)
Payments, location, kitchen/POS integration and order back-end. "Place order" only shows a
confirmation screen that says so.
