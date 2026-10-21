"""Builds every Quillmarc logo SVG.

Run from the repo root:  python3 brand/tools/build_logos.py

Two parts:
- The wordmark (primary logo): the pen-written Q, then "uillmarc" in Newsreader Regular
  (72pt optical size, 2000 units per em, -0.02em tracking; wordmark-path.txt, made by
  outline_wordmark.py, which removes the dot of the "i"). Gold squares end the Q's tail
  and dot the "i".
- The symbol: a pen-written Q. An outer circle minus a tilted inner ellipse gives the
  thick-thin stress of a broad nib; a tapered tail crosses the stroke and ends in the
  same square full stop (mark.json, on a 40-unit grid).
"""
import json
import math
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "assets" / "logo"
WORD = (HERE / "wordmark-path.txt").read_text().strip()
MARK = json.loads((HERE / "mark.json").read_text())
WORD_W, CAP, XH, ASC, DESC = 7027.0, 1340.0, 852.0, 1470.0, 530.0  # WORD_W: "uillmarc"
I_DOT = (1245.0, -1471.0, 268.0)  # the i dot's box within "uillmarc", from outline_wordmark.py

INK, REVERSE, SAPPHIRE, NAVY, BRASS, PAPER = "#102542", "#FAF8F5", "#1E3A5F", "#102542", "#DDB040", "#FAF8F5"

# (ink, full stop) per colourway
WAYS = {
    "ink": (INK, BRASS),            # primary, on paper
    "ink-mono": (INK, INK),         # one colour: print, fax, embossing
    "reverse": (REVERSE, BRASS),       # on navy, sapphire or dark
    "reverse-mono": (REVERSE, REVERSE),
    "sapphire": (SAPPHIRE, BRASS),
}


def svg(w, h, body, minx=0.0, miny=0.0, bg=None, radius=0):
    rect = f'<rect x="{minx:g}" y="{miny:g}" width="{w:g}" height="{h:g}" rx="{radius:g}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx:g} {miny:g} {w:g} {h:g}" '
        f'width="{w:g}" height="{h:g}" role="img" aria-label="Quillmarc">{rect}{body}</svg>\n'
    )


def mark(ink, dot, tx=0.0, ty=0.0, s=1.0):
    x, y, q = MARK["sq"]
    return (
        f'<g transform="translate({tx:g} {ty:g}) scale({s:g})">'
        f'<path fill-rule="evenodd" fill="{ink}" d="{MARK["ring"]}"/>'
        f'<path fill="{ink}" d="{MARK["tail"]}"/>'
        f'<rect x="{x}" y="{y}" width="{q}" height="{q}" rx="0.5" fill="{dot}"/></g>'
    )


def _ring(cx, cy, R, rx, ry, rot, dx=0.0, dy=0.0):
    """Outer circle minus a tilted inner ellipse: the broad-nib bowl (evenodd)."""
    a = math.radians(rot)
    ix, iy = cx + dx, cy + dy
    sx, sy = ix - rx * math.cos(a), iy - rx * math.sin(a)
    ex, ey = ix + rx * math.cos(a), iy + rx * math.sin(a)
    return (f"M{cx - R:.1f} {cy:.1f}a{R:.1f} {R:.1f} 0 1 0 {2 * R:.1f} 0a{R:.1f} {R:.1f} 0 1 0 {-2 * R:.1f} 0Z"
            f"M{sx:.1f} {sy:.1f}A{rx:.1f} {ry:.1f} {rot} 1 0 {ex:.1f} {ey:.1f}A{rx:.1f} {ry:.1f} {rot} 1 0 {sx:.1f} {sy:.1f}Z")


def _tail(x1, y1, x2, y2, w1, w2):
    """A stroke that tapers from w1 to w2, like a pen lifting."""
    ang = math.atan2(y2 - y1, x2 - x1)
    nx, ny = -math.sin(ang), math.cos(ang)
    pts = [(x1 + nx * w1 / 2, y1 + ny * w1 / 2), (x2 + nx * w2 / 2, y2 + ny * w2 / 2),
           (x2 - nx * w2 / 2, y2 - ny * w2 / 2), (x1 - nx * w1 / 2, y1 - ny * w1 / 2)]
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


def wordmark_units():
    """The wordmark in font units, baseline at y=0: (ink paths, squares, width).

    The Q is the symbol redrawn at cap height, its strokes thinned to match
    Newsreader Regular. Both squares, the Q's full stop and the dot of the i,
    are the size of Newsreader's own i dot."""
    R = CAP * 0.53
    cx, cy = R + 10, -R + 18          # the bowl overshoots the baseline slightly, like a real O
    bowl = _ring(cx, cy, R, R * 0.885, R * 0.80, -40, R * 0.025, R * 0.02)
    t0, t1 = R * 0.27, R * 0.98
    tail = _tail(cx + t0, cy + t0, cx + t1, cy + t1, R * 0.25, R * 0.135)
    q = I_DOT[2]
    q_square = (cx + t1 - q * 0.18, cy + t1 - q * 0.18, q)
    ux = 2 * R + 10 + CAP * 0.055     # a little air between the Q and the u
    ix, iy, isz = I_DOT
    ink = [bowl, tail, f'<path transform="translate({ux:.1f} 0)" d="{WORD}"/>']
    squares = [q_square, (ux + ix, iy, isz)]
    return ink, squares, ux + WORD_W


def wordmark(ink, dot, cap):
    """Returns (body, width, ascent, descent) with the baseline at y=0."""
    s = cap / CAP
    paths, squares, w = wordmark_units()
    body = f'<g transform="scale({s:.5f})" fill="{ink}">'
    for p in paths:
        body += p if p.startswith("<") else f'<path fill-rule="evenodd" d="{p}"/>'
    for x, y, q in squares:
        body += f'<rect x="{x:.1f}" y="{y:.1f}" width="{q:.1f}" height="{q:.1f}" rx="{q * 0.1:.1f}" fill="{dot}"/>'
    body += "</g>"
    return body, w * s, ASC * s, (DESC * 0.8 + 120) * s


def inline_symbol():
    """The same wordmark as an SVG <symbol> for the site: ink follows currentColor, squares use --brass."""
    paths, squares, w = wordmark_units()
    inner = ""
    for p in paths:
        inner += p.replace("<path ", '<path fill="currentColor" ') if p.startswith("<") else f'<path fill="currentColor" fill-rule="evenodd" d="{p}"/>'
    for x, y, q in squares:
        inner += f'<rect x="{x:.1f}" y="{y:.1f}" width="{q:.1f}" height="{q:.1f}" rx="{q * 0.1:.1f}" fill="var(--brass)"/>'
    return f'<symbol id="qm-word" viewBox="0 -1480 {w + 20:.0f} 1960">{inner}</symbol>', w + 20


def write(name, content):
    (OUT / name).write_text(content)
    print("wrote", name)


OUT.mkdir(parents=True, exist_ok=True)

# Primary logo: the wordmark with its full stop. Cap height 40 at 1:1.
for k, (ink, dot) in WAYS.items():
    body, w, asc, desc = wordmark(ink, dot, 40)
    write(f"quillmarc-logo-{k}.svg", svg(round(w + 1), round(asc + desc), body, 0, -round(asc)))

# Symbol alone
for k, (ink, dot) in WAYS.items():
    write(f"quillmarc-symbol-{k}.svg", svg(40, 40, mark(ink, dot)))

# App icons
write("quillmarc-app-icon.svg", svg(512, 512, mark(REVERSE, BRASS, 96, 96, 8.0), bg=NAVY, radius=112))
write("quillmarc-app-icon-paper.svg", svg(512, 512, mark(INK, BRASS, 96, 96, 8.0), bg=PAPER, radius=112))

# Favicon: follows the browser's colour scheme
x, y, q = MARK["sq"]
write(
    "favicon.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32">'
    "<style>.i{fill:#102542}.d{fill:#DDB040}@media (prefers-color-scheme: dark){.i{fill:#FAF8F5}.d{fill:#DDB040}}</style>"
    f'<path class="i" fill-rule="evenodd" d="{MARK["ring"]}"/><path class="i" d="{MARK["tail"]}"/>'
    f'<rect class="d" x="{x}" y="{y}" width="{q}" height="{q}" rx="0.5"/></svg>\n',
)


# Inline the same wordmark into the site and the brand page, so the page logo never drifts from the files
sym, _ = inline_symbol()
for page in (HERE.parents[1] / "index.html", HERE.parents[1] / "brand" / "index.html"):
    html = page.read_text()
    html, n = re.subn(r'<symbol id="qm-word".*?</symbol>', lambda m: sym, html, flags=re.S)
    if n == 1:
        page.write_text(html)
        print("updated logo in", page.relative_to(HERE.parents[1]))
