# Inspirapixel digits (Brick & Coin, Olympus Hunt): Pixelify Sans 0-9 with a proper 5 (Pixelify's 5 is drawn almost exactly like its S).
# Makes one small static woff2 per weight (400/500/600/700) containing only the ten digits, renamed "Inspirapixel Digits".
# usage: python -I digits.py <PixelifySans variable woff2> <out dir>
import sys, os, base64, io, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset

src, out = sys.argv[1], sys.argv[2]
DIGITS = '0123456789'

def pts(font, g):
    p = RecordingPen(); font.getGlyphSet()[g].draw(p)
    contours, cur = [], []
    for op, a in p.value:
        if op in ('moveTo', 'lineTo'): cur.append(a[0])
        elif op == 'closePath': contours.append(cur); cur = []
        else: raise SystemExit('curves? ' + op)
    return contours

def new_five(font):
    six = pts(font, 'six'); s, hole = six[0], six[1]
    old = pts(font, 'five')[0]
    # the shapes these points come from (default weight): see the comment beside each
    assert len(s) == 20 and len(hole) == 4 and len(old) == 32, (len(s), len(hole), len(old))
    L, R = s[2][0], s[8][0]            # outer left (60) and right (525) edges
    TOP, IN_TOP = s[5][1], s[11][1]     # top (631) and the top bar's lower edge (530)
    return [
        s[0], s[1], s[2],                # bottom bar's left end, the bottom-left notch
        old[3], old[4], old[5],          # the little stub on the lower left (like the old 5's)
        hole[1], hole[2],                # inside of the bowl
        (L, hole[2][1]),                 # the middle bar runs to the left edge
        (L, TOP), (R, TOP), (R, IN_TOP), # a square, full-width top bar: what makes it a 5, not an S
        s[12], s[13], s[14], s[15], s[16], s[17], s[18], s[19],   # the stem down to the middle bar, and the 6's bowl
    ]

def build(w):
    f = TTFont(src)
    f = instancer.instantiateVariableFont(f, {'wght': w}, updateFontNames=False)
    five = new_five(f)
    pen = TTGlyphPen(None); pen.moveTo(five[0])
    for p in five[1:]: pen.lineTo(p)
    pen.closePath()
    g = pen.glyph(); f['glyf']['five'] = g
    adv = f['hmtx']['five'][0]; g.recalcBounds(f['glyf']); f['hmtx']['five'] = (adv, g.xMin)
    opts = subset.Options(); opts.layout_features = []; opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; opts.flavor = 'woff2'; opts.hinting = False
    sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in DIGITS]); sub.subset(f)
    for r in f['name'].names:
        if r.nameID in (1, 4, 16): r.string = 'Inspirapixel Digits' if r.nameID != 4 else f'Inspirapixel Digits {w}'
        if r.nameID == 6: r.string = f'InspirapixelDigits-{w}'
    buf = io.BytesIO(); f.flavor = 'woff2'; f.save(buf); data = buf.getvalue()
    open(os.path.join(out, f'bcdigits-{w}.woff2'), 'wb').write(data)
    return base64.b64encode(data).decode(), five

res = {}
for w in (400, 500, 600, 700):
    b64, five = build(w); res[w] = b64
    print(w, len(b64), 'chars', five[9:12])
json.dump(res, open(os.path.join(out, 'bcdigits.json'), 'w'))
print(TTFont(src)['name'].getDebugName(0)); print(TTFont(src)['name'].getDebugName(13))
