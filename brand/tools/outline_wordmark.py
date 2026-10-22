"""Outline text, removing the dot (tittle) of every 'i'. Prints width and each dot's bbox.

Usage: outline_wordmark.py font.ttf text tracking_em out.txt [grow]
`grow` (font units, default 0) thickens every stroke by that much in total, so hairlines gain
proportionally more than stems; it is baked into the outline with skia-pathops."""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen, DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import pathops
f=TTFont(sys.argv[1]); gs=f.getGlyphSet(); cmap=f.getBestCmap(); upm=f['head'].unitsPerEm
text=sys.argv[2]; track=float(sys.argv[3])*upm
grow=float(sys.argv[5]) if len(sys.argv)>5 else 0
x=0; parts=[]; dots=[]
def contours(rec):
    cs=[]; cur=[]
    for op,args in rec.value:
        cur.append((op,args))
        if op in ('closePath','endPath'): cs.append(cur); cur=[]
    if cur: cs.append(cur)
    return cs
for ch in text:
    g=cmap[ord(ch)]; rec=DecomposingRecordingPen(gs); gs[g].draw(rec)
    cs=contours(rec)
    keep=cs
    if ch=='i':
        def top(c):
            ys=[p[1] for op,args in c for p in args]; return min(ys)
        dot=max(cs,key=top); keep=[c for c in cs if c is not dot]
        bp=BoundsPen(gs)
        for op,args in dot: getattr(bp,op)(*args)
        x0,y0,x1,y1=bp.bounds; dots.append([x+x0,-y1,x1-x0,y1-y0])
    pen=SVGPathPen(gs); tp=TransformPen(pen,(1,0,0,-1,x,0))
    if grow:
        pp=pathops.Path(); gp=TransformPen(pp.getPen(glyphSet=gs),(1,0,0,-1,x,0))
        for c in keep:
            for op,args in c: getattr(gp,op)(*args)
        st=pathops.Path(pp); st.stroke(grow,pathops.LineCap.BUTT_CAP,pathops.LineJoin.MITER_JOIN,4)
        pathops.union([pp,st],pen)
    else:
        for c in keep:
            for op,args in c: getattr(tp,op)(*args)
    parts.append(pen.getCommands()); x+=gs[g].width+track
x-=track
open(sys.argv[4],'w').write(' '.join(parts))
print(json.dumps({"width":x,"dots":dots}))
