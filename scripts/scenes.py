# Génère css/scenes.css : la vignette de décor de chaque carte du Bestiaire.
# Une vignette par zone d'origine, en couleur, d'après l'ambiance de la zone dans le jeu
# (palette, matières, repères) ; dessins originaux en aplats, pas de reprise de visuels.
# Autres séries : un atelier par métier pour les équipements, l'élément pour les sorts,
# un temple pour les classes, le Krosmoz pour les Dofus. Variantes « souterrain » et
# « cimetière » pour les sous-zones de ce type, dans les couleurs de leur zone.
import math, os
from urllib.parse import quote

def svg(body, defs=''):
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice'>"
            f"<defs>{defs}</defs>{body}</svg>")

_gid = [0]
def sky(top, bottom):
    _gid[0] += 1
    i = f"s{_gid[0]}"
    return (f"<linearGradient id='{i}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='{top}'/><stop offset='1' stop-color='{bottom}'/></linearGradient>",
            f"<rect width='100' height='100' fill='url(#{i})'/>")
def glow(cx, cy, r, color, op=.6):
    _gid[0] += 1
    i = f"g{_gid[0]}"
    return (f"<radialGradient id='{i}'><stop offset='0' stop-color='{color}' stop-opacity='{op}'/><stop offset='1' stop-color='{color}' stop-opacity='0'/></radialGradient>",
            f"<circle cx='{cx}' cy='{cy}' r='{r}' fill='url(#{i})'/>")

def p(fill, d, extra=''): return f"<path fill='{fill}' d='{d}'{extra}/>"
def st(color, d, w=1): return f"<path fill='none' stroke='{color}' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round' d='{d}'/>"
def circ(x, y, r): return f"M{x-r:.2f} {y}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0"
def ell(x, y, rx, ry): return f"M{x-rx:.2f} {y}a{rx} {ry} 0 1 0 {2*rx} 0a{rx} {ry} 0 1 0 {-2*rx} 0"
def star(x, y, r):
    k = r * .3
    return f"M{x} {y-r}L{x+k} {y-k}L{x+r} {y}L{x+k} {y+k}L{x} {y+r}L{x-k} {y+k}L{x-r} {y}L{x-k} {y-k}Z"
def tr(body, tx, ty, k=1, flip=False):
    sx = -k if flip else k
    return f"<g transform='translate({tx} {ty}) scale({sx} {k})'>{body}</g>"
def hill(y, amp, ph=0, n=3):
    d = f"M0 {y}"
    for i in range(1, 21):
        x = i * 5
        d += f"L{x} {y - amp * math.sin((x / 100) * n * math.pi + ph):.1f}"
    return d + "V100H0Z"

# ---------------- éléments réutilisables, toujours colorés par la zone
def round_tree(x, b, r, leaf, dark, trunk):
    return (p(trunk, f"M{x-1.2} {b}L{x-.8} {b-r*1.3}H{x+.8}L{x+1.2} {b}Z") + p(dark, circ(x + r * .25, b - r * 1.85, r)) +
            p(leaf, circ(x - r * .2, b - r * 2, r * .85)) + p(leaf, circ(x - r * .75, b - r * 1.55, r * .55)))
def pine(x, b, h, w, c, snow=None, trunk='#5a3a24'):
    out = p(trunk, f"M{x-.8} {b}V{b-h*.15}H{x+.8}V{b}Z")
    for k, (t, ww) in enumerate([(1, .55), (.72, .8), (.45, 1)]):
        top, bot = b - h * t, b - h * (t - .42) - h * .1
        out += p(c, f"M{x} {top}L{x+w*ww} {bot}H{x-w*ww}Z")
        if snow: out += p(snow, f"M{x} {top}L{x+w*ww*.45} {top+(bot-top)*.45}L{x} {top+(bot-top)*.32}L{x-w*ww*.45} {top+(bot-top)*.45}Z")
    return out
def palm(x, b, h, lean, trunk, leaf):
    tx, ty = x + lean, b - h
    out = st(trunk, f"M{x} {b}Q{x+lean*.2} {b-h*.6} {tx} {ty}", 1.8)
    for a, l in [(-160, 9), (-120, 8), (-60, 8), (-20, 9), (-90, 6)]:
        r = math.radians(a)
        ex, ey = tx + l * math.cos(r), ty + l * math.sin(r) + 4
        out += p(leaf, f"M{tx} {ty}Q{(tx+ex)/2} {min(ty,ey)-3} {ex:.1f} {ey:.1f}Q{(tx+ex)/2} {min(ty,ey)} {tx} {ty}Z")
    return out
def house(x, b, w, h, wall, beam, roof, roof_d):
    rh = h * .75
    return (p(wall, f"M{x} {b}V{b-h}H{x+w}V{b}Z") + st(beam, f"M{x} {b-h}H{x+w}M{x+w*.33} {b-h}V{b}M{x+w*.66} {b-h}V{b}M{x} {b-h*.5}H{x+w}", .6) +
            p(roof, f"M{x-1.5} {b-h}L{x+w/2} {b-h-rh}L{x+w+1.5} {b-h}Z") + p(roof_d, f"M{x+w/2} {b-h-rh}L{x+w+1.5} {b-h}H{x+w/2}Z") +
            p('#3a2a1a', f"M{x+w*.4} {b}V{b-h*.42}H{x+w*.6}V{b}Z") + p('#ffe6a0', f"M{x+w*.12} {b-h*.75}h{w*.14}v{h*.18}h{-w*.14}Z"))
def cloud(x, y, s, c):
    return p(c, circ(x, y, 3 * s) + circ(x + 4 * s, y - 1.5 * s, 3.8 * s) + circ(x + 8.5 * s, y, 3 * s) + f"M{x-3*s} {y}H{x+11.5*s}V{y+2.5*s}H{x-3*s}Z")
def shadow(): return p('rgba(0,0,0,.18)', ell(50, 86, 20, 3.4))

Z = {}
def zone(slug, body, defs=''): Z[slug] = svg(body, defs)

# ================================================================ ZONES
# Amakna : herbe vive, arbres d'automne, maisons à colombages aux toits orange
d1, b1 = sky('#8fcff0', '#e4f4fb')
zone('amakna', b1 + cloud(14, 16, 1, '#fff') + cloud(70, 10, .8, '#fff')
     + p('#8cc152', hill(58, 4, 1)) + p('#74ad3c', hill(64, 3, 2.5))
     + house(4, 62, 14, 9, '#f3e2bc', '#6b4423', '#e0612a', '#b8461c') + house(80, 60, 13, 8, '#f3e2bc', '#6b4423', '#e0612a', '#b8461c')
     + round_tree(24, 64, 4, '#f2b632', '#d98a1c', '#6b4423') + round_tree(73, 63, 3.6, '#e8761e', '#c4561a', '#6b4423') + round_tree(95, 66, 3.2, '#8cc63a', '#5f9a2a', '#6b4423')
     + p('#a6d64e', hill(72, 2, .5)) + p('#d8b47a', "M38 100Q46 80 50 72Q54 80 64 100Z") + shadow(), d1)

# Astrub : cité de pierre ocre au soleil, poutres, remparts
d1, b1 = sky('#f6d98a', '#fff4d6')
zone('astrub', b1 + p('#c99a52', "M0 60V40h6v-4h4v4h6v20ZM84 60V36h6v-4h4v4h6v24Z") + p('#e0b468', "M0 64V48h100v16Z") + st('#a0753a', "M0 48h100", .8)
     + "".join(p('#e0b468', f"M{x} 48v-3h3v3Z") for x in range(2, 100, 6))
     + p('#d9a85a', "M10 70V52h22v18ZM66 70V50h24v20Z") + p('#a8432a', "M8 52l13-9 13 9ZM64 50l14-10 14 10Z") + st('#6b4423', "M10 58h22M66 57h24M21 52v18M78 50v20", .6)
     + p('#ffe6a0', "M14 56h4v4h-4ZM70 54h4v4h-4ZM82 54h4v4h-4Z")
     + p('#e9cf94', "M0 70h100v30H0Z") + st('#cfae6a', "M0 78h100M0 88h100M10 70v8M30 78v10M50 70v8M70 78v10M90 70v8M20 88v12M60 88v12", .5)
     + p('#7cb83a', circ(36, 71, 2.4) + circ(62, 70, 2)) + shadow(), d1)

# Bonta : pierre blanche, toits bleus, ors, jardins soignés
d1, b1 = sky('#a9d8ff', '#eef8ff')
zone('bonta', b1 + cloud(60, 12, .8, '#fff')
     + p('#e6ebf4', "M4 64V36h12v28ZM84 64V32h12v32Z") + p('#3d6fc6', "M3 36l7-12 7 12ZM83 32l7-13 7 13Z") + p('#e9c04a', "M10 24v-4M90 19v-4") + p('#3d6fc6', "M10 20l4 1.5-4 1.5ZM90 15l4 1.5-4 1.5Z")
     + p('#f4f6fb', "M22 66V46h20v20ZM60 66V44h22v22Z") + p('#2b52a0', "M20 46a12 9 0 0 1 24 0ZM58 44a13 10 0 0 1 26 0Z") + p('#e9c04a', "M31 37v-3M71 34v-3")
     + p('#c9d3e6', "M28 66V54a4 4 0 0 1 8 0v12ZM67 66V52a4 4 0 0 1 8 0v14Z")
     + p('#9ccf6a', hill(70, 1.5)) + p('#e9ecf2', "M30 100L44 70H56L70 100Z") + p('#6ab04a', circ(14, 74, 3.5) + circ(86, 75, 3.5)) + p('#e86a8a', circ(13, 72, .8) + circ(16, 75, .8) + circ(87, 73, .8)) + shadow(), d1)

# Brâkmar : basalte sombre, fissures de lave, flèches noires, ciel de fumée rouge
d1, b1 = sky('#2a1210', '#7a2e16')
d2, b2 = glow(50, 90, 50, '#ff7a1e', .45)
zone('brakmar', b1 + p('rgba(255,140,60,.25)', ell(30, 22, 20, 4) + ell(76, 30, 18, 3))
     + p('#1e1616', "M0 70V44L5 30L9 46L15 22L21 50L26 40L30 60H70L74 36L80 52L85 18L91 46L96 34L100 50V70Z") + p('#a3201b', "M14 30h-5v6h5ZM86 26h5v6h-5Z")
     + p('#ffb04a', "M8 48h2v3H8ZM88 40h2v3h-2ZM18 54h2v3h-2Z") + b2
     + p('#3a2f2c', "M0 66h100v34H0Z") + st('#ff8a1e', "M0 80l12-3 8 5 14-4M60 92l10-6 12 4 18-5M20 98l10-8 6 3M44 74l6 4 8-2", 1.2) + st('#ffd04a', "M8 79l4-1M66 89l4-2", .6)
     + st('#241c1c', "M0 72H100M20 66v34M48 66v34M76 66v34", .4) + shadow(), d1 + d2)

# Plaines de Cania : herbe dorée, pics de grès pâles (Dents de Pierre), tour ronde
d1, b1 = sky('#f2df9a', '#fff5d4')
zone('plaines-de-cania', b1 + p('#d8c98e', hill(60, 3, 0)) + p('#d9b84a', hill(66, 2, 1.5))
     + p('#efe1b0', "M2 72L8 44L12 72ZM10 72L18 38L24 72ZM76 72L82 46L86 72ZM84 72L92 34L98 72Z") + p('#c9b07a', "M8 44L12 72H9ZM18 38L24 72H19ZM82 46L86 72H83ZM92 34L98 72H93Z")
     + p('#cfc2a0', "M62 70V48h10v22Z") + p('#8a5a3a', "M60 48l7-9 7 9Z") + p('#3a2a1a', "M65 70v-6h4v6Z")
     + round_tree(36, 70, 3, '#e8901f', '#c06a14', '#6b4423')
     + p('#c9a23a', hill(76, 1.5, 2)) + "".join(st('#e8cc6a', f"M{x} 100q1-6 0-10", .6) for x in range(4, 100, 7)) + shadow(), d1)

# Île de Frigost : neige, glace cyan lumineuse, sapins enneigés
d1, b1 = sky('#a8e2f4', '#f0fbff')
d2, b2 = glow(80, 50, 22, '#7fe8f8', .7)
zone('ile-de-frigost', b1 + p('#d8eef8', "M0 62L14 34L24 50L36 26L50 52L62 38L76 56L88 30L100 46V62Z") + p('#fff', "M10 42L14 34L18 42L14 40ZM32 34L36 26L40 34L36 32ZM84 38L88 30L92 38L88 36Z")
     + b2 + p('#7fe0f0', "M74 70L78 46L82 70ZM80 70L86 40L90 70ZM88 70L91 52L94 70Z") + p('#3fb6d8', "M78 46L82 70H79ZM86 40L90 70H87Z")
     + pine(10, 72, 22, 6, '#2f6f6a', '#fff') + pine(20, 70, 16, 4.5, '#2f6f6a', '#fff')
     + p('#f4fbff', hill(70, 2, .5)) + p('#cfe6f2', ell(70, 92, 30, 4)) + shadow(), d1 + d2)

# Île d'Otomaï : mer turquoise, plage, pontons de bois, l'Arche et sa voile à spirale, jungle
d1, b1 = sky('#7fd0ee', '#d8f4fb')
zone('ile-d-otomai', b1 + p('#2f9a5a', "M0 56Q10 40 22 50Q30 36 40 52V60H0Z") + p('#1f7a46', circ(8, 50, 6) + circ(30, 46, 7))
     + p('#2fb3c9', "M0 58h100v20H0Z") + st('#8fe6f0', "M4 64h10M30 70h14M70 62h12", .6)
     + p('#8a5a2e', "M58 64h36l-4 6H62Z") + st('#6b4423', "M76 64V30", 1.2) + p('#f6e4e8', "M76 32q14 8 0 26Z") + st('#e06a8a', "M80 44m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 0a5 5 0 1 1 9 0", .7)
     + p('#a0703a', "M6 74h40v3H6Z") + st('#7a5228', "M10 77v8M24 77v8M40 77v8", 1)
     + p('#f0d89a', "M0 80Q50 72 100 80V100H0Z") + palm(92, 84, 22, -6, '#8a5a2e', '#3aa04a') + shadow(), d1)

# Landes de Sidimote : terre brune craquelée, rochers rougeâtres, palissades, arbres morts
d1, b1 = sky('#d6a87a', '#f2d8b0')
zone('landes-de-sidimote', b1 + p('#a0583a', "M0 62L10 48L18 56L28 44L36 62Z") + p('#8a4a30', "M70 62L80 46L88 54L96 42L100 62Z")
     + p('#8a6a48', "M0 60h100v40H0Z") + st('#4a3624', "M6 72l8 4 4-3 10 5M60 80l10-4 6 5 12-2M26 92l8-4 10 4M70 96l6-4 8 3", .7)
     + st('#5a3a24', "M50 70V58M44 70V60M56 70V60M42 62h16", 1) + st('#3a2618', "M14 76V58l-5-6M14 62l6-6 2-4M88 74V56l4-6M88 62l-5-5", 1.4)
     + p('#6e5236', ell(20, 90, 10, 2)) + shadow(), d1)

# Montagne des Koalaks : verdure dense, plateaux de grès ocre, fougères, totem
d1, b1 = sky('#9fd8ee', '#e6f6fb')
zone('montagne-des-koalaks', b1 + p('#d9a85a', "M0 60V36q6-4 14-2l6 4V60ZM68 60V30q10-6 20-2l12 2V60Z") + p('#b07a3a', "M14 34l6 4V60H14ZM88 28l12 2V60H88Z")
     + p('#5aaa2a', "M0 36q8-6 14-2M68 30q10-6 20-2", '') + p('#4a9a2a', circ(4, 34, 4) + circ(76, 28, 4) + circ(90, 27, 3))
     + p('#7ccf3a', hill(64, 2.5, 1)) + p('#5aaa2a', hill(72, 2, 2))
     + "".join(p('#3f8a2a', f"M{x} 78q-6-8-10-6q6 0 10 6q-2-9 2-14q2 6-2 14q4-7 10-6q-5 2-10 6Z") for x in (12, 90))
     + p('#b07a3a', "M28 80V64h6v16Z") + p('#e0612a', "M27 64h8l-4-5Z") + p('#ffe6a0', "M29 68h1.5v1.5H29ZM31.5 68h1.5v1.5h-1.5Z") + shadow(), d1)

# Île de Pandala : vert tendre, eau claire, bambous, pont de bois, pagode rouge
d1, b1 = sky('#e2efc0', '#fbf8e6')
zone('ile-de-pandala', b1 + p('#b7cc7a', hill(56, 3, 1)) + tr(p('#c8402a', "M40 100V76h20V100ZM42 70V62h16v8ZM44 57v-7h12v7Z") + p('#3a2a24', "M33 76h34l-7-6H40ZM36 62h28l-6-5H42ZM39 50h22l-11-9Z"), 44, 17, .7)
     + p('#a8dcd8', "M0 70h100v12H0Z") + st('#d8f2ee', "M6 74h12M40 78h16M70 73h10", .6)
     + p('#b07a3a', "M18 72q22-12 44 0v2q-22-12-44 0Z") + st('#8a5a2a', "M22 70v6M58 70v6M40 66v8", .9)
     + "".join(p('#8ab84a', f"M{x} 82V{t}h2.4V82Z") + st('#6a9a2a', "".join(f"M{x} {y}h2.4" for y in range(t + 6, 82, 7)), .5) for x, t in [(2, 30), (7, 40), (94, 34)])
     + p('#6a9a2a', "M9 40q6-2 9 2q-5 0-9-2ZM4 32q-4-2-6 2q4 0 6-2ZM96 36q-5-2-8 2q4 0 8-2Z")
     + p('#c9d98a', "M0 82h100v18H0Z") + p('#f4a6b6', circ(30, 88, .9) + circ(70, 92, .9) + circ(52, 95, .8)) + shadow(), d1)

# Archipel de Vulkania : couchant, mer turquoise, pontons, volcan sombre et lave, palmiers
d1, b1 = sky('#ffb86a', '#ffeccc')
zone('archipel-de-vulkania', b1 + p('#ffe08a', circ(30, 40, 9)) + p('#3a3030', "M0 64L18 30H30L46 64Z") + p('#ff7a2a', "M18 30h12l-3 6-3-2-3 4Z") + st('#ff9a3a', "M24 36l-2 10 3 4-2 8", 1)
     + p('rgba(80,60,60,.55)', circ(22, 24, 4) + circ(27, 18, 5))
     + p('#2fc0c9', "M0 62h100v18H0Z") + st('#a8f0f0', "M50 66h14M72 72h18M10 74h10", .6)
     + p('#b07a3a', "M44 76h56v3H44Z") + st('#8a5a2a', "M50 79v8M66 79v8M84 79v8", 1)
     + palm(86, 76, 24, 6, '#8a5a2e', '#3aa03a') + palm(70, 76, 16, -4, '#8a5a2e', '#4ab040')
     + p('#f0d090', "M0 84Q50 78 100 84V100H0Z") + shadow(), d1)

# Île de Moon : plage claire, lagon, jungle, totems tiki
d1, b1 = sky('#8fe0f0', '#e8fbff')
zone('ile-de-moon', b1 + p('#2fb8c8', "M0 56h100v16H0Z") + p('#3a9a3a', "M50 58q16-22 36-4q8-2 14 4Z") + p('#2f7a2f', circ(64, 46, 6) + circ(78, 48, 5))
     + p('#f6e0a0', "M0 72Q50 64 100 72V100H0Z")
     + p('#8a5a2e', "M8 86V62h10v24Z") + p('#e8b84a', "M8 62h10l-5-5Z") + p('#2a1a0e', "M10 68h2.5v3H10ZM13.5 68h2.5v3h-2.5ZM10.5 76h5v2h-5Z") + p('#d9531e', "M8 72h10v2H8Z")
     + palm(90, 84, 26, -5, '#8a5a2e', '#3aa03a') + palm(28, 76, 16, 4, '#8a5a2e', '#4ab040') + shadow(), d1)

# Forêt des Abraknydes : futaie dense, verts profonds, sous-bois moussu
d1, b1 = sky('#8ab48a', '#cfe2c0')
zone('foret-des-abraknydes', b1 + "".join(round_tree(x, 64, r, '#3f8a34', '#2f6a2a', '#4a3020') for x, r in [(8, 7), (26, 6), (48, 5), (70, 6), (92, 7)])
     + p('#2f5220', hill(66, 2)) + "".join(round_tree(x, 84, r, '#4a9a3a', '#2f6a2a', '#5a3a24') for x, r in [(4, 6), (96, 6)])
     + p('#3f6a2a', "M0 78h100v22H0Z") + p('#5a8a3a', ell(30, 90, 12, 2.5) + ell(76, 94, 10, 2)) + p('#f6f0a0', circ(36, 60, .7) + circ(64, 56, .7) + circ(58, 70, .6)) + shadow(), d1)

# Forêt Maléfique : crépuscule violet-orange, château noir aux fenêtres jaunes, citrouilles
d1, b1 = sky('#4a2a5a', '#f0a050')
zone('foret-malefique', b1 + p('#ffe2a0', circ(76, 24, 7))
     + p('#2a1a2a', "M30 66V40h6v-6l3-6 3 6v6h12V30l4-8 4 8v10h8v26Z") + p('#ffd04a', "M40 50h2v3h-2ZM56 40h2v3h-2ZM50 56h2v3h-2Z")
     + st('#1e121e', "M8 74V50l-5-6M8 56l6-6 2-4M94 74V48l4-6M94 56l-5-5", 1.6)
     + p('#3a2a3a', "M0 70h100v30H0Z") + p('#f08a1e', ell(20, 84, 6, 4.5) + ell(84, 86, 5, 3.8)) + st('#c0601a', "M20 80v8M16 81v6M24 81v6M84 82v7", .5) + p('#3a6a2a', "M19 79h2v-2h-2ZM83 82h2v-2h-2Z") + shadow(), d1)

# Île des Wabbits : herbe vive, carottes géantes, mer, château du Wa
d1, b1 = sky('#a8e2ff', '#effaff')
zone('ile-des-wabbits', b1 + p('#2fb8d0', "M0 58h100v8H0Z")
     + p('#e8eef4', "M64 60V40h6v-4h4v4h8v-4h4v4h4v20Z") + p('#4a7ad0', "M62 40l6-8 6 8ZM78 40l6-8 6 8Z") + p('#ffffff', "M66 34l-1-4 2 3ZM82 34l-1-4 2 3Z")
     + p('#8fd84a', hill(66, 2, 1)) + p('#7cc63a', hill(74, 1.5, 2))
     + p('#f08a1e', "M10 88l-4-26h9ZM28 90l-3-16h6Z") + p('#3aa03a', "M10 62l-4-7 4 3 1-6 2 6 3-3-3 7ZM28 74l-3-5 3 2 1-4 1 4 2-2-2 5Z")
     + p('#5a3a1a', ell(80, 90, 6, 2)) + shadow(), d1)

# Île de Nowel : nuit bleue, neige, sapin décoré, maison aux fenêtres chaudes
d1, b1 = sky('#1e2a5a', '#6a7ac0')
zone('ile-de-nowel', b1 + p('#fff', "".join(circ(x, y, .6) for x, y in [(10, 10), (30, 20), (50, 8), (70, 16), (90, 10), (20, 34), (82, 30), (60, 28)]))
     + p('#c8402a', "M66 70V54h22v16Z") + p('#f4f8ff', "M63 54l14-10 14 10Z") + p('#ffd060', "M70 58h4v4h-4ZM80 58h4v4h-4Z")
     + pine(18, 80, 40, 12, '#1f5a3a', '#f4f8ff') + p('#ffd04a', star(18, 40, 2.6)) + p('#e8402a', circ(13, 66, 1.1) + circ(22, 60, 1.1) + circ(16, 54, 1)) + p('#ffd04a', circ(24, 70, 1.1) + circ(14, 74, 1))
     + p('#f4f8ff', hill(72, 2)) + p('#e8402a', "M30 84h7v6h-7Z") + p('#3a8ad0', "M38 86h5v4h-5Z") + st('#ffd04a', "M33.5 84v6M30 87h7", .6) + shadow(), d1)

# Incarnam : île flottante dorée au-dessus des nuages
d1, b1 = sky('#7ec8f2', '#e2f4ff')
zone('incarnam', b1 + cloud(4, 30, 1, '#fff') + cloud(74, 22, 1.1, '#fff')
     + p('#7a6650', "M8 66H92L76 84L60 96L50 88L36 94L22 80Z") + p('#a08a6a', "M8 66H92L80 74H20Z")
     + p('#f0c84a', "M6 66Q50 56 94 66Z") + p('#d9a83a', "M14 66Q30 62 46 64ZM58 64Q74 61 88 65Z")
     + round_tree(16, 66, 3, '#7cc63a', '#4a9a2a', '#6b4423') + round_tree(84, 65, 3.4, '#7cc63a', '#4a9a2a', '#6b4423')
     + cloud(-4, 90, 1.4, '#ffffff') + cloud(70, 92, 1.4, '#f4f8ff') + shadow().replace('86', '66'), d1)

# Saharach : sable doré, falaises de grès sculptées, palmiers
d1, b1 = sky('#ffd690', '#fff2d2')
zone('saharach', b1 + p('#fff4c0', circ(78, 22, 8))
     + p('#d9a050', "M0 62V34h10l4 6h8l2-6h6V62ZM74 62V38h8l2-4h10l6 6V62Z") + p('#b07a3a', "M4 62V48a4 4 0 0 1 8 0V62ZM80 62V50a4 4 0 0 1 8 0V62ZM18 44h4v6h-4Z")
     + p('#f2c86a', "M0 60Q30 54 60 62T100 58V100H0Z") + p('#e0a84a', "M0 76Q40 68 70 78T100 74V100H0Z")
     + palm(66, 64, 16, 3, '#8a5a2e', '#5aa03a') + p('#f0d8a0', "M8 90q6-6 12 0M10 92q4-4 8 0") + shadow(), d1)

# Dimensions des Cavaliers : ciel de fin du monde, terre fendue, ruines, feu
d1, b1 = sky('#3a1414', '#c0502a')
zone('dimensions-des-cavaliers', b1 + p('rgba(255,180,90,.35)', ell(50, 30, 40, 6))
     + p('#5a4a48', "M6 68V36h8v32ZM84 68V30h9v38Z") + p('#3a2e2e', "M6 36l3-5 5 4ZM84 30l4-6 5 5Z") + st('#6a5a58', "M30 68V52a20 18 0 0 1 40 0V68", 2)
     + p('#a3201b', "M10 40h6v10l-3-2-3 2Z")
     + p('#3a2a24', "M0 66h100v34H0Z") + st('#ff7a2a', "M4 78l10-4 6 5 12-3M60 90l10-6 8 4 16-4", 1) + st('#c0c0c0', "M44 88l1-14M88 92l1-12", 1) + st('#c0c0c0', "M41 76h8M85 82h7", .8) + shadow(), d1)

# Île de Grobe : brume, marais olive, torii rouge, tombes, esprits
d1, b1 = sky('#9aa88a', '#d8dcc4')
zone('ile-de-grobe', b1 + p('rgba(255,255,255,.35)', ell(30, 44, 30, 4) + ell(76, 52, 24, 3))
     + p('#c0402a', "M10 40h40v3H10ZM14 46h32v2H14ZM16 43v30h3V43ZM41 43v30h3V43Z") + p('#2a1a14', "M8 39h44l-2-3H10Z")
     + p('#6a7a4a', "M0 70h100v30H0Z") + p('#5a6a3a', ell(30, 84, 22, 3))
     + p('#9a9a8a', "M66 80V68a4 4 0 0 1 8 0V80ZM80 82V72a3.5 3.5 0 0 1 7 0V82Z") + p('#e8b84a', "M58 82v-6h3v6Z") + p('#ffe6a0', "M58.5 77h2v2h-2Z")
     + p('#c8f0ff', circ(86, 56, 1.4) + circ(60, 50, 1.1)) + p('rgba(200,240,255,.5)', "M86 56q-3-6 0-10q1 6 0 10ZM60 50q-2-5 0-8q1 5 0 8Z") + shadow(), d1)

# Sanctuaire des Jardins éternels : jardins luxuriants, arches de marbre, fleurs, fontaine
d1, b1 = sky('#bfe6ff', '#f2fbff')
zone('sanctuaire-des-jardins-eternels', b1 + p('#f2f0e6', "M6 70V36h6v34ZM88 70V36h6v34Z") + st('#f2f0e6', "M9 38q41-30 82 0", 3) + st('#5aa03a', "M9 40q41-28 82 0", 1.2)
     + p('#e86a8a', "".join(circ(x, 40 - 24 * math.sin(math.pi * (x - 9) / 82) + 1, 1) for x in range(14, 88, 8)))
     + p('#6ac04a', hill(70, 2)) + p('#e8e4d4', "M38 74h24v-3H38ZM46 71V62h8v9ZM40 62h20v-2H40Z") + st('#7ad0f0', "M50 58q-6-8-10 2M50 58q6-8 10 2", 1)
     + p('#5aa03a', circ(18, 76, 4) + circ(82, 78, 4)) + p('#ffd04a', circ(16, 74, .9) + circ(20, 77, .9) + circ(84, 76, .9)) + p('#e86a8a', circ(80, 79, .9)) + shadow(), d1)

# Baie de Sufokia : murs de grès crème, escaliers, mer turquoise, phare
d1, b1 = sky('#9fdcf8', '#eaf8ff')
zone('baie-de-sufokia', b1 + p('#2aa8d0', "M0 60h100v40H0Z") + st('#a8eaf8', "M6 70h12M40 78h16M70 88h14", .7)
     + p('#f0dcaa', "M0 76V44h26v6h8v6h8v20Z") + p('#d0b47a', "M26 50v26h-3V50ZM34 56v20h-3V56Z") + st('#d0b47a', "M0 52h26M0 60h26", .5)
     + p('#f4f0e6', "M78 70L80 34H86L88 70Z") + p('#c8402a', "M80 46h6v4h-6ZM79 58h8v4h-8Z") + p('#ffe08a', "M80 34h6l-3-5Z") + p('#d0b47a', "M74 72h18v-3H74Z")
     + p('#3a8ab0', "M48 82h20l-3 4H51Z") + st('#6b4423', "M58 82V68", .8) + p('#fff', "M58 69l6 10h-6Z") + shadow().replace('86', '92'), d1)

# Profondeurs de Sufokia : bleu profond, cité engloutie, algues, rais de lumière, bulles
d1, b1 = sky('#2a7ab0', '#0a2a4a')
zone('profondeurs-de-sufokia', b1 + p('rgba(180,230,255,.18)', "M24 0L14 70H26L34 0ZM60 0L56 60H66L70 0Z")
     + p('#3a6a88', "M26 74V44h5v30ZM40 74V40h5v34ZM55 74V40h5v34ZM69 74V44h5v30Z") + p('#4a7a98', "M22 44l28-12 28 12Z")
     + p('#123a5a', "M0 72h100v28H0Z") + st('#3aa080', "M6 100q-4-12 2-22t0-18M94 100q4-12-2-22t0-16", 2) + st('#2a8a6a', "M12 100q3-8 0-16", 1.4)
     + p('none', '') + st('#bfe8ff', circ(50, 30, 1.4) + circ(53, 22, 1) + circ(48, 14, .8), .5) + shadow(), d1)

# Gouffre du Gigalodon : abysse, mâchoire géante, falaises
d1, b1 = sky('#1a5a7a', '#04182e')
zone('gouffre-du-gigalodon', b1 + p('#0a2a40', "M0 100V40L10 52L8 70L18 100ZM100 100V36L90 50L94 66L84 100Z")
     + p('#2a3a48', "M22 48q28-24 56 0q-28-10-56 0ZM22 68q28 18 56 0q-28 8-56 0Z") + p('#e8eef2', "".join(f"M{x} {44 - 5*math.sin(math.pi*(x-22)/56):.1f}l1.5 5 1.5-5Z" for x in range(26, 76, 5)) + "".join(f"M{x} {70 + 5*math.sin(math.pi*(x-22)/56):.1f}l1.5 -5 1.5 5Z" for x in range(26, 76, 5)))
     + p('#ffd04a', circ(70, 50, 1.2)) + st('#bfe8ff', circ(40, 24, 1) + circ(44, 16, .7), .4) + shadow(), d1)

# Écaflipus : dimension du dieu joueur, plateformes flottantes, cartes, dés, rouge et or
d1, b1 = sky('#f8d8b0', '#fff2e0')
zone('ecaflipus', b1 + st('#e8b840', circ(50, 26, 12), 1.4) + st('#e8b840', "".join(f"M50 26L{50+12*math.cos(a):.1f} {26+12*math.sin(a):.1f}" for a in [i * math.pi / 4 for i in range(8)]), .6)
     + p('#c0302a', "M50 26m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0")
     + tr(p('#fffaf0', "M0 0h10v14H0Z") + p('#c0302a', "M5 4c-1-2 3-2 2 0-1 2-2 3-2 3s-1-1-3-3c-1-2 3-2 3 0Z"), 6, 44, 1) + tr(p('#fffaf0', "M0 0h10v14H0Z") + p('#2a2a2a', "M5 4l2 3-2 3-2-3Z"), 84, 40, 1)
     + p('#7a5a8a', "M8 70h26l-4 6H12ZM66 66h28l-4 6H70Z") + p('#5ab06a', "M8 70h26v-2H8ZM66 66h28v-2H66Z")
     + p('#e8d8b8', "M0 80h100v20H0Z") + p('#fff', "M14 86l8-4 6 6-8 4Z") + p('#2a2a2a', circ(20, 87, .8)) + p('#c0302a', "M78 84l8-2 2 6-8 2Z") + shadow(), d1)

# Enutrosor : or partout, galeries étayées, wagonnet, pièces
d1, b1 = sky('#c08a2a', '#ffe8a0')
zone('enutrosor', b1 + p('#6a4a1e', "M6 100V40h5v60ZM89 100V40h5v60Z") + p('#7a5222', "M4 40h92v-5H4Z")
     + p('#f6c83a', "M0 70Q20 56 40 68T80 64T100 68V100H0Z") + p('#d99a1a', "M0 80Q30 72 60 80T100 78V100H0Z")
     + p('#fff2a0', star(24, 60, 2) + star(70, 56, 1.6) + star(86, 70, 1.4))
     + p('#6a4a2a', "M62 84h20l-2 8H64Z") + p('#3a2a1a', circ(66, 93, 1.6) + circ(78, 93, 1.6)) + p('#f6c83a', circ(68, 82, 3) + circ(74, 81, 3.4) + circ(79, 83, 2.6)) + shadow(), d1)

# Srambad : nuit bleu-vert, cité gothique, lanternes cyan, lune
d1, b1 = sky('#0e2a3a', '#2a5a6a')
d2, b2 = glow(30, 24, 14, '#bff8f0', .5)
zone('srambad', b1 + b2 + p('#dff8f4', circ(30, 24, 5)) + p('#0e2a3a', circ(32, 23, 4.4))
     + p('#14222e', "M0 70V46l5-10 5 10V40h8V30l5-12 5 12v10h6V50h8V36l6-14 6 14v14h6V42l5-10 5 10v28Z") + p('#6af0e8', "M6 52h2v3H6ZM21 40h2v3h-2ZM46 44h2v3h-2ZM62 52h2v3h-2ZM76 48h2v3h-2Z")
     + p('#1a2a3a', "M0 68h100v32H0Z") + st('#2a4a5a', "M0 76h100M0 88h100", .5)
     + st('#3a4a5a', "M14 92V74M86 92V74", 1) + p('#6af0e8', circ(14, 73, 1.6) + circ(86, 73, 1.6)) + shadow(), d1 + d2)

# Xélorium : ciel sépia rosé, îles flottantes, horloges de laiton, engrenages
d1, b1 = sky('#e8a890', '#f8e2c8')
def gear(cx, cy, r, n):
    pts = []
    for i in range(n * 4):
        a = i / (n * 4) * 2 * math.pi
        rr = r if (i % 4) in (0, 1) else r * .8
        pts.append(f"{cx+rr*math.cos(a):.1f} {cy+rr*math.sin(a):.1f}")
    return "M" + "L".join(pts) + "Z"
zone('xelorium', b1 + p('#c0884a', gear(14, 30, 10, 10)) + p('#e8b8a0', circ(14, 30, 3.5)) + p('#a0703a', gear(88, 44, 8, 9))
     + p('#7a5a3a', "M60 40h34l-6 10-10 6-8-4Z") + p('#f6e0b0', circ(78, 26, 9)) + st('#7a5a3a', circ(78, 26, 9) + "M78 26v-6M78 26l4 3", .8)
     + p('#7a5a3a', "M4 66h30l-6 10-12 4-8-6Z") + p('#5a8a3a', "M4 66h30v-2H4Z")
     + p('#d9a84a', "M0 82h100v18H0Z") + st('#a0703a', "M0 86h100", .6) + shadow(), d1)

# Île de Pwâk : chocolat, rivière de crème, œufs décorés, temple de bois
d1, b1 = sky('#ffe0b8', '#fff6e6')
zone('ile-de-pwak', b1 + p('#8a4a26', "M58 64V40h30v24Z") + p('#c8902a', "M54 40l19-12 19 12Z") + p('#fff0d8', "M68 64V50h10v14Z")
     + p('#6a3a1e', "M0 62h100v38H0Z") + p('#fff0d8', "M0 76q20-6 40 0t36 0t24-2v6q-14 6-26 2t-34 0t-40 0Z")
     + p('#f6a6c0', "M14 70c-5 0-6-6-5-11s5-8 5-8 5 3 5 8 0 11-5 11Z") + st('#fff', "M10 62l2-1.5 2 1.5 2-1.5 2 1.5", .6)
     + p('#a6d8f6', "M88 92c-5 0-6-6-5-11s5-8 5-8 5 3 5 8 0 11-5 11Z") + st('#ffe08a', "M84 84l8 0M84 87l8 0", .8) + shadow(), d1)

# Archipel de Valonia : roche sombre, pins noirs, forge et sa lueur
d1, b1 = sky('#9ab0c0', '#dbe6ec')
d2, b2 = glow(70, 60, 14, '#ff8a2a', .55)
zone('archipel-de-valonia', b1 + p('#4a5258', "M0 64L18 26L30 44L44 18L58 46L72 30L88 50L100 36V64Z") + p('#5e676e', "M18 26L24 40L14 50ZM44 18L50 32L40 40Z")
     + p('#5a5a5a', "M60 70V50h20v20Z") + p('#3a3a3a', "M58 50l12-8 12 8Z") + b2 + p('#ffb04a', "M66 70v-8h8v8Z")
     + pine(10, 80, 28, 7, '#24402e') + pine(22, 82, 20, 5, '#2a4a34') + pine(92, 82, 24, 6, '#24402e')
     + p('#6a7068', "M0 76h100v24H0Z") + shadow(), d1 + d2)

# Île du Minotoror : herbe, murs de pierre du labyrinthe
d1, b1 = sky('#ffd8a8', '#fff2dc')
zone('ile-du-minotoror', b1 + p('#9ac04a', "M0 56h100v44H0Z")
     + p('#c9b48a', "M0 64h30v4H6v10h18v4H0ZM70 60h30v24h-4V64H74v8h-4Z") + p('#a08a5a', "M0 68h30v1H0ZM70 64h26v1H70Z")
     + p('#c9b48a', "M6 90h24v-4H10v-6H6ZM70 92h30v-4H74v-4h-4Z") + p('#a08a5a', "M6 90h24v1H6ZM70 92h30v1H70Z")
     + st('#e8dcc0', "M44 30q-8-12 4-18M56 30q8-12-4-18", 2) + shadow(), d1)

# Osavora : dimension d'Osamodas, ciel violet, cristaux d'or, sol améthyste
d1, b1 = sky('#3a1e5a', '#a070c0')
d2, b2 = glow(50, 40, 30, '#f0c040', .3)
zone('osavora', b1 + b2 + p('#fff', star(16, 14, 1.4) + star(84, 20, 1.2) + star(62, 10, 1))
     + p('#5a3a7a', "M0 64L16 50L30 58L46 46L62 56L80 44L100 54V64Z")
     + p('#f0c040', "M8 74L12 46L16 74ZM16 74L22 54L26 74ZM78 74L84 40L90 74ZM88 74L92 56L96 74Z") + p('#c8902a', "M12 46L16 74H13ZM84 40L90 74H86Z")
     + p('#4a2a6a', "M0 72h100v28H0Z") + p('#7a5aa0', ell(50, 88, 30, 4)) + shadow(), d1 + d2)

# Wukin et Wukang : papier et encre, montagnes au lavis, sceau rouge
d1, b1 = sky('#efe6d2', '#f8f2e4')
zone('wukin-et-wukang', b1 + p('rgba(30,30,30,.25)', "M0 62Q8 30 18 48Q26 22 38 44Q46 18 58 50Q66 36 74 54Q84 28 100 58V70H0Z") + p('rgba(30,30,30,.55)', "M0 74Q12 50 24 66Q34 52 44 70H0Z")
     + p('#c23b2b', "M82 12h10v10H82Z") + st('#f8f2e4', "M84 15h6M84 18h6M87 13v8", .6)
     + st('#1e1e1e', "M8 100V60M14 100V66", 1.6) + st('#1e1e1e', "M8 66q6-2 10 2M8 74q-6 0-8 4M14 72q5-2 8 2", .7)
     + p('#f4ecd8', "M0 80h100v20H0Z") + st('rgba(30,30,30,.35)', "M0 82q50-4 100 0", .6) + shadow(), d1)

# Île de Sakaï : plaine enneigée, roches grises, mine abandonnée
d1, b1 = sky('#c8dcec', '#f2f8fc')
zone('ile-de-sakai', b1 + p('#8a9aa8', "M0 62L20 36L32 50L48 30L64 50L80 40L100 56V62Z") + p('#fff', "M16 42L20 36L24 42ZM44 36L48 30L52 36Z")
     + p('#eef6ff', "M0 60h100v40H0Z") + p('#5a3a24', "M60 78V62h22v16h-4V66H64v12Z") + p('#2a1e14', "M64 78V66h14v12Z")
     + st('#7a6a5a', "M64 80l-10 18M78 80l10 18M60 86h24M56 94h32", .8) + pine(14, 80, 22, 6, '#2f5a4a', '#fff') + shadow(), d1)

# Dimension obscure : violet profond, pyramide d'ombre, lueur
d1, b1 = sky('#1a1028', '#4a3070')
d2, b2 = glow(50, 40, 26, '#b080ff', .45)
zone('dimension-obscure', b1 + b2 + p('#e6d8ff', star(12, 14, 1.4) + star(86, 12, 1.2) + star(74, 30, .9))
     + p('#0e0818', "M12 74L50 18L88 74Z") + p('#2a1a40', "M50 18L88 74H54Z") + p('#e6d8ff', ell(50, 46, 5, 3)) + p('#0e0818', circ(50, 46, 1.6))
     + p('#1e1430', "M0 72h100v28H0Z") + shadow(), d1 + d2)

# Nimotopia : royaume du rêve, pastels, bulles et nuages
d1, b1 = sky('#c8b8f0', '#f6efff')
zone('nimotopia', b1 + st('#fff', circ(18, 22, 5) + circ(30, 34, 2.4) + circ(78, 18, 6) + circ(88, 32, 2.4), .8) + p('#fff6a0', star(56, 14, 1.6))
     + cloud(0, 70, 1.6, '#ffffff') + cloud(64, 72, 1.6, '#f4eeff') + p('#e6dcff', "M0 78h100v22H0Z") + p('#d0c0f8', ell(50, 88, 30, 3)) + shadow(), d1)

# Archipel des Écailles : marais vert d'eau, roseaux, crocodile, carapace géante
d1, b1 = sky('#b8dcc0', '#eef8ee')
zone('archipel-des-ecailles', b1 + p('#5a8a5a', "M56 62q18-28 40 0Z") + st('#3a6a4a', "M62 58l6-10 8 6 8-6 6 10M76 46v10", .8)
     + p('#4a9a8a', "M0 60h100v40H0Z") + st('#8ad8c8', "M6 68h12M40 74h16M70 84h14", .6)
     + p('#3a6a3a', "M18 80q6-4 12 0q-6 2-12 0ZM30 80q4-3 8 0") + p('#ffe08a', circ(22, 79, .8) + circ(28, 79, .8))
     + st('#4a7a3a', "M6 90V62M10 90V68M94 90V60M90 90V66", 1.2) + p('#8a5a2e', "M5 62h2v8H5ZM93 60h2v8h-2Z") + shadow(), d1)

# Atoll des Possédés : mer d'orage, navire pirate, lueurs vertes de possession
d1, b1 = sky('#2a3a4a', '#6a7a8a')
zone('atoll-des-possedes', b1 + p('rgba(255,255,255,.25)', ell(26, 20, 18, 4))
     + p('#1e2a36', "M0 62h100v38H0Z") + st('#4a6a7a', "M4 70h14M40 76h18M70 88h16", .7)
     + p('#2a1e14', "M48 66h44l-6 8H54Z") + st('#2a1e14', "M70 66V24M58 66V36", 1.2) + p('#1a1a1a', "M70 28l16 14H70ZM70 44l14 12H70ZM58 38l-10 12h10Z") + p('#e8e8e8', circ(78, 40, 1.4))
     + p('#6ae0a0', circ(20, 56, 1.6) + circ(34, 50, 1.2)) + p('rgba(106,224,160,.35)', circ(20, 56, 4) + circ(34, 50, 3))
     + palm(10, 84, 18, 4, '#3a2a1a', '#2a5a3a') + p('#c8b080', "M0 84Q20 80 34 86V100H0Z") + shadow(), d1)

# Cauchemar des Ravageurs : brume pourpre, épines, yeux dans le noir
d1, b1 = sky('#2e0e38', '#a060a8')
zone('cauchemar-des-ravageurs', b1 + st('#e0a0e8', "M30 22m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 0a5 5 0 1 1 9 0a8 8 0 1 1-14 0", .7)
     + p('#1e0a26', "M0 76V54L8 38L12 54L20 30L26 52L34 22L40 56L50 40L56 58L66 20L72 54L80 36L86 56L94 30L100 50V76Z")
     + p('#3a1446', "M0 72h100v28H0Z") + p('rgba(200,140,220,.35)', ell(50, 76, 50, 5))
     + p('#ffd0ff', ell(20, 84, 2.6, 1.2) + ell(28, 84, 2.6, 1.2)) + p('#2e0e38', circ(20, 84, .7) + circ(28, 84, .7)) + shadow(), d1)

# Gelaxième dimension : espace pastel, planètes, gelées géantes
d1, b1 = sky('#4a4a9a', '#f0c8f0')
zone('gelaxieme-dimension', b1 + p('#f6a6d0', circ(22, 22, 7)) + st('#fff', ell(22, 22, 12, 3), .8) + p('#fff', star(70, 14, 1.4) + star(86, 32, 1) + star(56, 30, .9))
     + p('#7ad8f0', "M4 82a14 16 0 0 1 28 0Z") + p('#f6a6d0', "M66 82a16 18 0 0 1 32 0Z") + p('#a6f0c0', "M40 84a6 7 0 0 1 12 0Z")
     + p('#fff', circ(12, 72, 1.4) + circ(22, 72, 1.4) + circ(76, 68, 1.6) + circ(88, 68, 1.6))
     + p('#d8c8f0', "M0 82h100v18H0Z") + shadow(), d1)

# Îlots de la mer d'Asse : théâtre de Dramak, rideaux rouges, scène
d1, b1 = sky('#3a1a1a', '#7a3a2a')
d2, b2 = glow(50, 40, 30, '#ffe0a0', .45)
zone('ilots-de-la-mer-d-asse', b1 + b2 + p('#a3201b', "M0 0H100V8Q80 18 70 8Q60 20 50 8Q40 20 30 8Q20 18 0 8Z") + p('#c0302a', "M0 0V100Q8 60 14 6ZM100 0V100Q92 60 86 6Z")
     + p('#e8b840', "M0 8Q20 18 30 8Q40 20 50 8Q60 20 70 8Q80 18 100 8", " stroke='#e8b840' stroke-width='.6' fill='none'")
     + p('#8a5a2e', "M12 76h76v24H12Z") + st('#6a4422', "M12 82h76M12 90h76", .5) + p('#ffe0a0', circ(20, 76, 1) + circ(80, 76, 1)) + shadow(), d1 + d2)

# Labyrinthe du Dragon Cochon : souterrain, murs du dédale, torches
d1, b1 = sky('#3a2010', '#6a3a1e')
zone('labyrinthe-du-dragon-cochon', b1 + p('#2a160a', "M0 0H100V12L92 24L86 12L76 28L68 12L58 20L50 12L40 26L32 12L22 22L14 12L6 24L0 16Z")
     + p('#8a5a34', "M0 60H30V66H8V80H24V74H14V70H30V100H0ZM70 60H100V100H92V68H78V86H86V92H70Z") + p('#6a3a1e', "M0 60H30v2H0ZM70 60H100v2H70Z")
     + p('#5a3018', "M30 80h40v20H30Z") + st('#3a2010', "M40 46V60M60 46V60", 1.2) + p('#ffb04a', "M40 46q-3-5 0-9q3 4 0 9ZM60 46q-3-5 0-9q3 4 0 9Z") + shadow(), d1)

# Foire du Trool : chapiteau rayé, grande roue, fanions
d1, b1 = sky('#7ac8f0', '#f6e8d0')
zone('foire-du-trool', b1 + st('#8a3a6a', "M0 12q25 10 50 0t50 0", .6) + "".join(p(['#e8402a', '#ffd04a', '#3a8ad0'][i % 3], f"M{x} {12 + 4*math.sin((x/50)*math.pi):.1f}l2 5 2-5Z") for i, x in enumerate(range(4, 100, 8)))
     + st('#6a4a8a', circ(80, 46, 15) + "".join(f"M80 46L{80+15*math.cos(a):.1f} {46+15*math.sin(a):.1f}" for a in [i * math.pi / 4 for i in range(8)]) + "M74 76l6-30 6 30", .8)
     + p('#e8402a', "M6 80L24 44L42 80Z") + p('#fff', "M24 44L18 80H22ZM24 44L30 80H26ZM24 44L10 80H14ZM24 44L38 80H34Z") + p('#ffd04a', "M24 44V38l5 2-5 2Z")
     + p('#8ac04a', "M0 78h100v22H0Z") + shadow(), d1)

# ================================================================ VARIANTES DE SOUS-ZONES
d1, b1 = sky('#2a1e16', '#5a4430')
zone('souterrain', b1 + p('#1a120c', "M0 0H100V14L92 30L86 14L76 36L68 14L58 24L50 14L40 34L32 14L22 26L14 14L6 30L0 20Z")
     + p('#3a2a1e', "M0 100V86L8 70L14 86L22 64L30 86H70L76 68L82 86L92 74L100 84V100Z") + p('#4a3828', "M0 80h100v20H0Z")
     + st('#2a1e16', "M18 52V64M82 50V62", 1.2) + p('#ffb04a', "M18 52q-3-5 0-9q3 4 0 9ZM82 50q-3-5 0-9q3 4 0 9Z") + p('rgba(255,170,70,.25)', circ(18, 50, 8) + circ(82, 48, 8)) + shadow(), d1)
d1, b1 = sky('#3a3a5a', '#8a8aa8')
zone('cimetiere', b1 + p('#eef0ff', circ(78, 20, 7)) + p('#3a3a5a', circ(80, 19, 6.2))
     + st('#2a2a3a', "M10 76V52l-5-6M10 58l6-6 2-4", 1.4) + p('#5a6a4a', "M0 70h100v30H0Z")
     + p('#9a9aa8', "M24 80V68a5 5 0 0 1 10 0V80ZM66 82V66a6 6 0 0 1 12 0V82Z") + p('#8a8a98', "M48 80V68h-4v-3h4v-4h3v4h4v3h-4V80Z")
     + p('rgba(255,255,255,.3)', ell(50, 74, 50, 3)) + shadow(), d1)

# ================================================================ AUTRES SÉRIES
# Équipements : l'atelier du métier qui les fabrique
def workshop(wall, wall_d, floor, body):
    d, b = sky(wall, wall_d)
    return d, b + st('rgba(0,0,0,.12)', "M0 20h100M0 40h100M0 60h100" + "".join(f"M{x} {y}v20" for y in (20, 40, 60) for x in range(10 if y % 40 else 0, 100, 20)), .5) + p(floor, "M0 76h100v24H0Z") + body + shadow()
d1, b1 = workshop('#3a2a5a', '#5a4a7a', '#4a3a2a', p('#2a1e48', "M30 70h40v6H30Z") + p('#c0302a', ell(50, 66, 14, 4)) + p('#f6e0a0', circ(44, 62, 1.4) + circ(56, 63, 1.2)) + p('#fff', star(20, 30, 1.6) + star(82, 24, 1.4)))
zone('bijoutier', b1, d1)
d1, b1 = workshop('#d8b88a', '#c8a06a', '#8a6a40', p('#6a4a2a', "M78 76V30h16v46Z") + p('#8a5a34', "M80 34h12v40H80Z") + st('#e8d0a0', "M86 34v40", .5)
                  + p('#c0402a', "M8 46h12l2 10H6Z") + st('#6a4a2a', "M14 56v20M10 76h8", 1) + st('#3a8ad0', "M30 30q10 6 20 0", 1.2))
zone('tailleur', b1, d1)
d1, b1 = workshop('#c89a6a', '#a87a4a', '#7a5a3a', p('#6a4a2a', "M10 60h80v4H10Z") + p('#8a5a34', "M20 52h10v8H20ZM70 50h12v10H70Z") + st('#4a3020', "M24 36l8 8M32 36l-8 8", 1)
                  + p('#5a3a24', "M74 40h4v10h-4Z"))
zone('cordonnier', b1, d1)
d1, b1 = workshop('#4a3a32', '#2a201c', '#3a2e28', p('#ff8a2a', ell(84, 70, 10, 6)) + p('rgba(255,138,42,.3)', circ(84, 62, 16)) + p('#3a3a3a', "M76 64h16v12H76Z")
                  + p('#5a5a5a', "M8 72h22v-4h-6l2-6H14l2 6H8Z") + st('#9a9aa8', "M40 28l12 20M60 28l-12 20", 1.4) + p('#6a4a2a', "M38 26h6v4h-6ZM56 26h6v4h-6Z"))
zone('forgeron', b1, d1)
d1, b1 = workshop('#d0b080', '#b08a5a', '#8a6a40', p('#7a5a34', "M10 74l6-30h4l-6 30ZM84 74l-4-34h4l4 34Z") + st('#5a3a1e', "M30 60q10-24 20 0", 1.4) + p('#e8d8a8', ell(70, 72, 8, 2))
                  + st('#8a6a40', "M64 70l4-4M70 70l3-5M76 70l2-4", .5))
zone('sculpteur', b1, d1)
d1, b1 = workshop('#8a9aa8', '#6a7a88', '#5a5048', p('#8a5a34', ell(20, 52, 9, 12)) + p('#c0a040', circ(20, 52, 3)) + p('#9aa0a8', "M70 40h20v24l-10 8-10-8Z") + p('#c0302a', "M76 46h8v12h-8Z")
                  + p('#5a4a3a', "M40 72h20v4H40Z"))
zone('faconneur', b1, d1)

# Sorts et classes : fond aux couleurs de la classe, son symbole en filigrane (posé par card.js)
BREEDS = {1: ('#f0c890', '#b8642a'), 2: ('#9ad0c8', '#2a4a4a'), 3: ('#fbe08a', '#c08a1a'), 4: ('#cfc4b0', '#4a4038'),
          5: ('#a8d8f0', '#2a5a8a'), 6: ('#f6c8a0', '#b0402a'), 7: ('#fad0e0', '#c0507a'), 8: ('#f0b0a0', '#9a2a1e'),
          9: ('#d8eaa0', '#5a7a2a'), 10: ('#c8e0a0', '#5a7a3a'), 11: ('#f0a090', '#7a1a14'), 12: ('#d8eee8', '#3a6a5a'),
          13: ('#b8b8c8', '#2a2a3a'), 14: ('#e8c8f0', '#6a3a8a'), 15: ('#f8d0a0', '#a8501a'), 16: ('#b0f0f0', '#1a7a8a'),
          17: ('#d8d0f8', '#4a3a8a'), 18: ('#e0d0b0', '#4a3a2a'), 20: ('#f6e2a0', '#8a6a2a')}
for bid, (a, b) in BREEDS.items():
    d, g = glow(50, 45, 55, a, .9)
    d2, s2 = sky(b, b)
    zone(f'classe-{bid}', s2 + g + p('rgba(0,0,0,.12)', ell(50, 88, 26, 4)), d2 + d)
d1, b1 = sky('#120c2a', '#4a3a8a')
d2, b2 = glow(50, 50, 30, '#a080ff', .4)
zone('krosmoz', b1 + b2 + p('#fff', "".join(star(x, y, r) for x, y, r in [(14, 18, 2.2), (30, 34, 1.2), (78, 14, 2), (88, 40, 1.2), (60, 24, 1), (20, 60, 1), (82, 72, 1.6), (10, 84, 1.2)])) + st('rgba(255,255,255,.5)', "M14 18L30 34L60 24L78 14L88 40", .4) + shadow(), d1 + d2)

def uri(s): return 'url("data:image/svg+xml,' + quote(s, safe="=:/ '(),") + '")'
out = ["/* Vignettes de décor des cartes du Bestiaire. Généré par scripts/scenes.py : ne pas modifier à la main. */"]
for z, s in Z.items():
    out.append(f".bc-scene.z-{z}{{background-image:{uri(s)}}}")
open(os.path.join(os.path.dirname(__file__), '..', 'css', 'scenes.css'), 'w').write("\n".join(out) + "\n")
print(len(Z), 'décors,', sum(len(l) for l in out) // 1024, 'Ko')
