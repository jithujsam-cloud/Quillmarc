"""Builds every Quillmark logo SVG from one mark geometry and the outlined wordmark.

Run from the repo root:  python3 brand/tools/build_logos.py
The wordmark path is Newsreader Medium (72pt optical size), outlined at 2000 units per em,
tracking -0.015em, baseline at y=0. See brand/tools/wordmark-path.txt.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "logo"
WORD = (Path(__file__).parent / "wordmark-path.txt").read_text().strip()
WORD_W, CAP = 9167.0, 1340.0  # advance width and cap height in font units

INK, REVERSE, BRAND, RAISED, SURFACE = "#16201C", "#F7F3EA", "#1D4A40", "#FBF9F4", "#F5F1E8"

# The mark on a 32-unit grid: a ring (the bowl of a Q), a short tail that crosses the
# stroke, and a filled square, the full stop that closes the update.
RING_C, RING_R, STROKE = 14.0, 9.0, 2.6
TAIL = (17.6, 17.6, 23.9, 23.9)
DOT = (23.2, 23.2, 4.8)  # x, y, size


def mark(color, tx=0.0, ty=0.0, s=1.0):
    x1, y1, x2, y2 = TAIL
    dx, dy, ds = DOT
    return (
        f'<g transform="translate({tx:g} {ty:g}) scale({s:g})" fill="none">'
        f'<circle cx="{RING_C}" cy="{RING_C}" r="{RING_R}" stroke="{color}" stroke-width="{STROKE}"/>'
        f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{STROKE}"/>'
        f'<rect x="{dx}" y="{dy}" width="{ds}" height="{ds}" rx="0.5" fill="{color}"/>'
        f"</g>"
    )


def word(color, x, baseline, cap_px):
    s = cap_px / CAP
    return f'<path transform="translate({x:g} {baseline:g}) scale({s:.6f})" d="{WORD}" fill="{color}"/>', WORD_W * s


def svg(w, h, body, label="Quillmark", bg=None, radius=0):
    rect = f'<rect width="{w:g}" height="{h:g}" rx="{radius:g}" fill="{bg}"/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
        f'role="img" aria-label="{label}">{rect}{body}</svg>\n'
    )


def write(name, content):
    (OUT / name).write_text(content)
    print("wrote", name)


OUT.mkdir(parents=True, exist_ok=True)
for old in ["quillmark-mark-reverse-on-green.svg"]:
    (OUT / old).unlink(missing_ok=True)

colours = {"ink": INK, "reverse": REVERSE, "brand": BRAND}

# Mark alone
for k, c in colours.items():
    write(f"quillmark-mark-{k}.svg", svg(32, 32, mark(c)))

# Wordmark alone (cap height 40, so the file is 1:1 at a common display size)
for k, c in colours.items():
    cap = 40
    body, ww = word(c, 0, cap + 2, cap)
    write(f"quillmark-wordmark-{k}.svg", svg(round(ww + 1), cap + 16, body))

# Horizontal lockup: mark height = 1.5 x cap height, gap = 0.5 x mark, baseline aligned
# with the bottom of the ring so the tail and full stop hang just below the line.
for k, c in colours.items():
    cap = 40
    m = cap * 1.95         # rendered mark box size: the ring spans cap height plus overshoot
    s = m / 32
    gap = m * 0.24
    ring_bottom = (RING_C + RING_R + STROKE / 2) * s
    baseline = ring_bottom
    body_w, ww = word(c, m + gap, baseline, cap)
    h = m
    # the ring's bottom sits on the baseline; the tail and full stop hang below it
    write(f"quillmark-lockup-horizontal-{k}.svg", svg(round(m + gap + ww + 1), round(h), mark(c, 0, 0, s) + body_w))

# Stacked lockup: mark centred above the wordmark
for k, c in colours.items():
    cap = 40
    _, ww = word(c, 0, 0, cap)
    m = cap * 2.2
    s = m / 32
    w = ww + 2
    # centre the ring, not the box, so the full stop hangs off-axis like a written Q
    mx = w / 2 - RING_C * s
    gap = cap * 0.7
    baseline = m + gap + cap
    body_w, _ = word(c, 1, baseline, cap)
    write(f"quillmark-lockup-stacked-{k}.svg", svg(round(w), round(baseline + cap * 0.4), mark(c, mx, 0, s) + body_w))

# App icon and favicons
write("quillmark-app-icon.svg", svg(512, 512, mark(REVERSE, 102, 102, 9.6), bg=BRAND, radius=112))
write("quillmark-app-icon-light.svg", svg(512, 512, mark(INK, 102, 102, 9.6), bg=SURFACE, radius=112))

# Favicon: follows the browser's colour scheme
fav = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">'
    "<style>.m{color:#16201C}@media (prefers-color-scheme: dark){.m{color:#EEE8DA}}</style>"
    '<g class="m">'
    + mark("currentColor", 0.5, 0.5, 0.97)
    + "</g></svg>\n"
)
write("favicon.svg", fav)
