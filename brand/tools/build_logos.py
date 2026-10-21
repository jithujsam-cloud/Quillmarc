"""Builds every Quillmark logo SVG.

Run from the repo root:  python3 brand/tools/build_logos.py

Two parts:
- The wordmark (primary logo): "Quillmark" in Newsreader Regular, 72pt optical size,
  outlined at 2000 units per em with -0.02em tracking (wordmark-path.txt), followed by a
  brass square full stop.
- The symbol: a pen-written Q. An outer circle minus a tilted inner ellipse gives the
  thick-thin stress of a broad nib; a tapered tail crosses the stroke and ends in the
  same square full stop (mark.json, on a 40-unit grid).
"""
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parents[1] / "assets" / "logo"
WORD = (HERE / "wordmark-path.txt").read_text().strip()
MARK = json.loads((HERE / "mark.json").read_text())
WORD_W, CAP, XH, ASC, DESC = 8780.0, 1340.0, 852.0, 1470.0, 530.0
DOT_K = 0.36  # full stop size as a share of x-height

INK, REVERSE, SAPPHIRE, NAVY, BRASS, PAPER = "#102542", "#FAF8F5", "#1E3A5F", "#102542", "#C79C5A", "#FAF8F5"

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
        f'width="{w:g}" height="{h:g}" role="img" aria-label="Quillmark">{rect}{body}</svg>\n'
    )


def mark(ink, dot, tx=0.0, ty=0.0, s=1.0):
    x, y, q = MARK["sq"]
    return (
        f'<g transform="translate({tx:g} {ty:g}) scale({s:g})">'
        f'<path fill-rule="evenodd" fill="{ink}" d="{MARK["ring"]}"/>'
        f'<path fill="{ink}" d="{MARK["tail"]}"/>'
        f'<rect x="{x}" y="{y}" width="{q}" height="{q}" rx="0.5" fill="{dot}"/></g>'
    )


def wordmark(ink, dot, cap):
    """Returns (body, width, ascent, descent) with the baseline at y=0."""
    s = cap / CAP
    sq = XH * s * DOT_K
    gap = cap * 0.06
    body = (
        f'<path transform="scale({s:.5f})" d="{WORD}" fill="{ink}"/>'
        f'<rect x="{WORD_W * s + gap:.2f}" y="{-sq:.2f}" width="{sq:.2f}" height="{sq:.2f}" rx="{sq * 0.1:.2f}" fill="{dot}"/>'
    )
    return body, WORD_W * s + gap + sq, ASC * s, DESC * s * 0.8


def write(name, content):
    (OUT / name).write_text(content)
    print("wrote", name)


OUT.mkdir(parents=True, exist_ok=True)

# Primary logo: the wordmark with its full stop. Cap height 40 at 1:1.
for k, (ink, dot) in WAYS.items():
    body, w, asc, desc = wordmark(ink, dot, 40)
    write(f"quillmark-logo-{k}.svg", svg(round(w + 1), round(asc + desc), body, 0, -round(asc)))

# Symbol alone
for k, (ink, dot) in WAYS.items():
    write(f"quillmark-symbol-{k}.svg", svg(40, 40, mark(ink, dot)))

# Lockup for social avatars and signage: symbol, generous gap, wordmark
for k in ("ink", "reverse"):
    ink, dot = WAYS[k]
    cap = 40
    m = cap * 1.7
    s = m / 40
    base = 31 / 40 * m  # bottom of the ring sits on the baseline
    body, w, asc, desc = wordmark(ink, dot, cap)
    gx = m + cap * 0.7
    write(
        f"quillmark-lockup-{k}.svg",
        svg(round(gx + w + 1), round(m), mark(ink, dot, 0, 0, s) + f'<g transform="translate({gx:.2f} {base:.2f})">{body}</g>'),
    )

# App icons
write("quillmark-app-icon.svg", svg(512, 512, mark(REVERSE, BRASS, 96, 96, 8.0), bg=NAVY, radius=112))
write("quillmark-app-icon-paper.svg", svg(512, 512, mark(INK, BRASS, 96, 96, 8.0), bg=PAPER, radius=112))

# Favicon: follows the browser's colour scheme
x, y, q = MARK["sq"]
write(
    "favicon.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="32" height="32">'
    "<style>.i{fill:#102542}.d{fill:#C79C5A}@media (prefers-color-scheme: dark){.i{fill:#FAF8F5}.d{fill:#C79C5A}}</style>"
    f'<path class="i" fill-rule="evenodd" d="{MARK["ring"]}"/><path class="i" d="{MARK["tail"]}"/>'
    f'<rect class="d" x="{x}" y="{y}" width="{q}" height="{q}" rx="0.5"/></svg>\n',
)
