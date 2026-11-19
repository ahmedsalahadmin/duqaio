"""Bundle the site into one page for publishing as a claude.ai Artifact.

The Artifact host only loads scripts from a few CDNs and stylesheets from Google Fonts, and it wraps
the page in its own <html>/<head>/<body>. So this inlines styles.css and the four JS modules (each
module kept in its own scope), keeps the Google Fonts links, and copies the dish images next to it.

Usage: py -3.11 tools/build_artifact.py <out_dir>
Writes <out_dir>/duqaio.html and <out_dir>/assets/dishes/*.webp
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, 'assets', 'dishes'), exist_ok=True)


def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()


html = read('index.html')
title = re.search(r'<title>(.*?)</title>', html, re.S).group(1).strip()
fonts = re.findall(r'<link[^>]+fonts\.googleapis\.com/css2[^>]+>', html)
body = re.search(r'<body>(.*)</body>', html, re.S).group(1)
body = re.sub(r'\s*<script type="module" src="js/app.js"></script>', '', body)

# ── JS: wrap each module in its own scope, turn imports into destructuring ──
MODULES = [('data', 'js/data.js'), ('glitch', 'js/glitch.js'), ('doodles', 'js/doodles.js'), ('app', 'js/app.js')]
by_file = {os.path.basename(p): name for name, p in MODULES}
chunks = []
for name, path in MODULES:
    src = read(path)

    def imp(m):
        names, f = m.group(1), os.path.basename(m.group(2))
        return f'const {{{names}}} = __m_{by_file[f]};'
    src = re.sub(r"^import \{([^}]*)\} from '([^']+)';", imp, src, flags=re.M)
    exported = re.findall(r'^export (?:const|let|function|class) (\w+)', src, flags=re.M)
    src = re.sub(r'^export ', '', src, flags=re.M)
    ret = f'\nreturn {{ {", ".join(exported)} }};' if exported else ''
    chunks.append(f'// ── {path} ──\nconst __m_{name} = (() => {{\n{src}{ret}\n}})();')
js = '\n\n'.join(chunks)
# guard against a stray closing tag inside the inline script
js = js.replace('</script', '<\\/script')

page = f"""<title>{title}</title>
<meta name="description" content="Mobile-first noodle ordering prototype: spin the bowls, open one, order.">
{chr(10).join(fonts)}
<style>
{read('styles.css')}
</style>
{body.strip()}
<script>
{js}
</script>
"""
with open(os.path.join(OUT, 'duqaio.html'), 'w', encoding='utf-8') as f:
    f.write(page)

n = 0
src_dir = os.path.join(ROOT, 'assets', 'dishes')
for fn in os.listdir(src_dir):
    if fn.endswith('.webp'):
        shutil.copy2(os.path.join(src_dir, fn), os.path.join(OUT, 'assets', 'dishes', fn))
        n += 1
print(f'page {len(page) // 1024} KB, {n} images, title "{title}"')
