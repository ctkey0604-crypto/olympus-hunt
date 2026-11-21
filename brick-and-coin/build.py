#!/usr/bin/env python3
"""Join the Brick & Coin source parts into the playable pages.

  python3 brick-and-coin/build.py

  public/index.html   the website (brickncoin.com): the whole game as one page, plus icons and link-preview tags.
                      It also works on its own: open it in a browser, or upload it anywhere.
  dist/artifact.html  the same game as a fragment (title + style + markup + script) for a Claude artifact.

Parts in src/ are joined in name order: 00_style.html, 01_body.html, then every .js file.
To add a new part, give it a number between its neighbours (e.g. 35_world.js runs after 30_sim.js).
The other files in public/ (icons, manifest, _headers, robots.txt) are made by tools/site_images.js or written by hand.
"""
import os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
SITE = 'https://brickncoin.com'

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

style = read(os.path.join(SRC, '00_style.html'))
body = read(os.path.join(SRC, '01_body.html'))
js = ''.join(read(p) for p in sorted(glob.glob(os.path.join(SRC, '*.js'))))
script = '<script>\n' + js + '</script>\n'

DESC = ('Build a business empire in a pixel-art town. Turn wood, wheat and ore into pianos, cars and gift hampers, '
        'play a live stock market shared with every player, and become the richest tycoon in Millbrook.')
HEAD = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="theme-color" content="#130d0b">\n')
SITE_HEAD = (f'<meta name="description" content="{DESC}">\n'
             f'<link rel="canonical" href="{SITE}/">\n'
             '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
             '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
             '<link rel="manifest" href="/manifest.webmanifest">\n'
             '<meta name="apple-mobile-web-app-title" content="Brick &amp; Coin">\n'
             '<meta property="og:type" content="website">\n'
             '<meta property="og:title" content="Brick &amp; Coin">\n'
             f'<meta property="og:description" content="{DESC}">\n'
             f'<meta property="og:url" content="{SITE}/">\n'
             f'<meta property="og:image" content="{SITE}/og.png">\n'
             '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
             '<meta name="twitter:card" content="summary_large_image">\n')
TITLE = '<title>Brick &amp; Coin</title>\n'

builds = {
    os.path.join(HERE, 'public', 'index.html'): HEAD + SITE_HEAD + TITLE + style + '</head>\n<body>\n' + body + script + '</body>\n</html>\n',
    os.path.join(HERE, 'dist', 'artifact.html'): TITLE + '<meta name="claude:viewport-fit-sides" content="cover">\n' + style + body + script,
}

m = re.search(r"const VERSION = '([^']+)'", js)
print('Brick & Coin', m.group(1) if m else '(no VERSION found)')
for path, text in builds.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'  {os.path.relpath(path, HERE)}: {len(text.encode("utf-8")):,} bytes')
