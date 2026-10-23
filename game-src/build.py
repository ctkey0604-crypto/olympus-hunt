#!/usr/bin/env python3
"""Join the Olympus Hunt source parts into the three builds.

  python3 build.py [outdir]

  site.html        -> public/index.html on Connor's site (full document + favicon)
  crazygames.html  -> CrazyGames upload (no favicon, SDK script after <title>)
  artifact.html    -> Claude artifact (fragment: style + markup + script)
"""
import os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'dist')

def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()

style = read('00_style.html')
body = read('01_body.html')
js_parts = sorted(p for p in glob.glob(os.path.join(HERE, '*.js')))
script = '<script>\n(() => {\n\'use strict\';\n' + ''.join(read(os.path.basename(p)) for p in js_parts) + '</script>\n'

META = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="description" content="A free pixel-art monster-hunting game in your browser. Hunt monsters, '
        'forge gear from their parts, and take on the gods of Olympus.">\n'
        '<meta name="theme-color" content="#130d0b">\n')
FAV = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
TITLE = '<title>Olympus Hunt</title>\n'
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n'

def doc(head_extra_before_title, after_title):
    return (META + head_extra_before_title + TITLE + after_title + style + '\n</head>\n<body>\n'
            + body + '\n' + script + '</body>\n</html>\n')

builds = {
    'site.html': doc(FAV, ''),
    'crazygames.html': doc('', SDK),
    'artifact.html': TITLE + '<meta name="claude:viewport-fit-sides" content="cover">\n' + style + '\n' + body + '\n' + script,
}
os.makedirs(OUT, exist_ok=True)
for name, text in builds.items():
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{name}: {len(text.encode("utf-8")):,} bytes')
