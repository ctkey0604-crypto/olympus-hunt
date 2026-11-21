#!/usr/bin/env python3
"""Join the Brick & Coin source parts into playable pages.

  python3 brick-and-coin/build.py [outdir]        (outdir defaults to brick-and-coin/dist)

  brick-and-coin.html  the whole game as one page: open it in a browser, or upload it anywhere
  artifact.html        the same game as a fragment (title + style + markup + script) for a Claude artifact

Parts in src/ are joined in name order: 00_style.html, 01_body.html, then every .js file.
To add a new part, give it a number between its neighbours (e.g. 35_loans.js runs after 30_sim.js).
"""
import os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'dist')

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

style = read(os.path.join(SRC, '00_style.html'))
body = read(os.path.join(SRC, '01_body.html'))
js = ''.join(read(p) for p in sorted(glob.glob(os.path.join(SRC, '*.js'))))
script = '<script>\n' + js + '</script>\n'

HEAD = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="theme-color" content="#130d0b">\n')
TITLE = '<title>Brick &amp; Coin</title>\n'

builds = {
    'brick-and-coin.html': HEAD + TITLE + style + '</head>\n<body>\n' + body + script + '</body>\n</html>\n',
    'artifact.html': TITLE + '<meta name="claude:viewport-fit-sides" content="cover">\n' + style + body + script,
}

m = re.search(r"const VERSION = '([^']+)'", js)
print('Brick & Coin', m.group(1) if m else '(no VERSION found)')
os.makedirs(OUT, exist_ok=True)
for name, text in builds.items():
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'  {name}: {len(text.encode("utf-8")):,} bytes')
