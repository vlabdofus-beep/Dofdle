# Génère css/scenes.css : le décor de chaque zone d'origine des cartes du Bestiaire.
# Chaque zone a sa palette (ciel, sol) et trois plans dessinés pour elle :
#   ciel  : ce qui flotte au-dessus (aurore, corbeaux, pétales, lune…), teinte --c-sky
#   loin  : le paysage ou le monument emblématique, teinte --c-far
#   près  : le premier plan (végétation, objets), dans l'encre de la carte
# Les dessins sont originaux (silhouettes gravées), inspirés de l'esprit de chaque zone.
import math, os
from urllib.parse import quote

def svg(body):
    pat = ("<defs><pattern id='h' width='1.5' height='1.5' patternUnits='userSpaceOnUse' patternTransform='rotate(28)'>"
           "<rect width='.6' height='1.5' fill='#fff'/></pattern>"
           "<pattern id='d' width='1.5' height='1.5' patternUnits='userSpaceOnUse' patternTransform='rotate(28)'>"
           "<rect width='1.05' height='1.5' fill='#fff'/></pattern></defs>")
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" + pat + body + "</svg>"

def Sw(w): return f"fill='none' stroke='#fff' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round'"
H = "fill='url(#h)' stroke='#fff' stroke-width='.6' stroke-linejoin='round'"   # gravure claire
D = "fill='url(#d)' stroke='#fff' stroke-width='.6' stroke-linejoin='round'"   # gravure dense
S = Sw(.8)
F = "fill='#fff'"
def g(a, d): return f"<path {a} d='{d}'/>"
def circ(x, y, r): return f"M{x-r:.1f} {y}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0"
def ell(x, y, rx, ry): return f"M{x-rx:.1f} {y}a{rx} {ry} 0 1 0 {2*rx} 0a{rx} {ry} 0 1 0 {-2*rx} 0"
def star(x, y, r):
    k = r * .3
    return f"M{x} {y-r}L{x+k} {y-k}L{x+r} {y}L{x+k} {y+k}L{x} {y+r}L{x-k} {y+k}L{x-r} {y}L{x-k} {y-k}Z"
def pine(x, b, h, w):
    return (f"M{x} {b-h}L{x+w*.55} {b-h*.55}H{x+w*.3}L{x+w} {b-h*.12}H{x+.8}V{b}H{x-.8}V{b-h*.12}H{x-w}"
            f"L{x-w*.3} {b-h*.55}H{x-w*.55}Z")
def tree(x, b, r): return f"M{x-1} {b}V{b-r*1.2}H{x+1}V{b}Z" + circ(x, b - r * 1.9, r) + circ(x - r * .8, b - r * 1.4, r * .7) + circ(x + r * .8, b - r * 1.4, r * .7)
def waves(y0, rows, amp=2.5, step=6, x0=0, n=10):
    return "".join(f"M{x0} {y0+k*step}" + "q2.5 -%s 5 0t5 0" % amp * n for k in range(rows))
def gear(cx, cy, r, n):
    pts = []
    for i in range(n * 4):
        a = i / (n * 4) * 2 * math.pi
        rr = r if (i % 4) in (0, 1) else r * .8
        pts.append(f"{cx+rr*math.cos(a):.1f} {cy+rr*math.sin(a):.1f}")
    return "M" + "L".join(pts) + "Z" + circ(cx, cy, r * .35)
def crenel(x0, x1, y, h=3, w=3):
    d, x = f"M{x0} {y}", x0
    while x + w * 2 <= x1:
        d += f"h{w}v{-h}h{w}v{h}"; x += w * 2
    return d + f"H{x1}"
def bird(x, y, s=3): return f"M{x-s} {y-s*.4}q{s*.5} {-s*.5} {s} {s*.4}q{s*.5} {-s*.9} {s} {-s*.4}"
def tr(body, tx, ty, k): return f"<g transform='translate({tx} {ty}) scale({k})'>{body}</g>"
def flower(x, y, r=1.3): return ''.join(circ(x + r * math.cos(a), y + r * math.sin(a), r * .75) for a in [i * 2 * math.pi / 5 for i in range(5)])
def petal(x, y, r=1.4, a=0): return f"M{x} {y}q{r} {-r} {r*2} 0q{-r} {r} {-r*2} 0Z"

GROUND = "M0 86Q50 82 100 86V100H0Z"

# ---------------------------------------------------------------- zones
# chaque entrée : ciel, sol, couleur du plan lointain, couleur du ciel dessiné, (ciel, loin, près)
Z = {}
def zone(slug, sky, ground, cfar, csky, sky_d, far_d, near_d):
    Z[slug] = (sky, ground, cfar, csky, sky_d, far_d, near_d)

# Amakna : bocage doré, champs de blé, moulin et château au loin
zone('amakna', '#cfe8f6', '#7fb04a', '#4f7a36', '#ffffff',
     g(H, circ(18, 18, 5) + circ(25, 15, 6) + circ(31, 19, 4)) + g(H, circ(72, 12, 4) + circ(78, 10, 5)),
     g(H, "M0 70Q20 58 42 66T82 60T100 62V100H0Z") + g(D, "M56 60V50h3v-3l2-3 2 3v3h4v-4l2-3 2 3v4h3V60Z") + g(S, crenel(56, 73, 50, 1.5, 1.5)),
     g(H, "M82 88L84 62H90L92 88Z") + g(F, "M83 62L87 56L91 62Z") + g(Sw(1.4), "M87 59L76 49M87 59L98 49M87 59L77 71M87 59L97 70")
     + g(D, "M4 90V78h12v12Z") + g(F, "M2 78l8-6 8 6Z") + g(Sw(.9), "".join(f"M{x} 92q1-6 0-10M{x+1.5} 92q-1-5 1-9" for x in range(24, 74, 5))))

# Astrub : cité de pierre, remparts crénelés, grand portail et tours
zone('astrub', '#e3ebf2', '#b89a68', '#7e6a4c', '#ffffff',
     g(S, bird(20, 18) + bird(28, 22, 2) + bird(76, 14)),
     g(D, "M4 100V58h10V100ZM86 100V54h10V100Z") + g(S, crenel(3, 15, 58, 2, 2) + crenel(85, 97, 54, 2, 2)) + g(H, "M14 100V68H86V100Z") + g(S, crenel(14, 86, 68, 2.5, 3)),
     g(D, "M40 100V80a10 10 0 0 1 20 0V100Z") + g(S, "M50 70v-8") + g(F, "M50 62l6 2-6 2Z") + g(S, "M24 76h8v6h-8ZM68 76h8v6h-8Z"))

# Bonta : cité blanche aux dômes et flammes bleues, ailes et soleil
zone('bonta', '#eef5fd', '#6f97cf', '#4a6fae', '#fff6d8',
     g(S, circ(50, 16, 7) + "".join(f"M{50+11*math.cos(a):.1f} {16+11*math.sin(a):.1f}l{3*math.cos(a):.1f} {3*math.sin(a):.1f}" for a in [i * math.pi / 6 for i in range(12)])),
     g(H, "M6 100V64h10V100ZM84 100V64h10V100Z") + g(D, "M6 64a5 6 0 0 1 10 0ZM84 64a5 6 0 0 1 10 0Z") + g(H, "M30 100V56h16V100ZM54 100V56h16V100Z") + g(D, "M30 56a8 10 0 0 1 16 0ZM54 56a8 10 0 0 1 16 0Z") + g(S, "M38 46v-6M62 46v-6M11 58v-5M89 58v-5"),
     g(Sw(.9), "M8 84q8-10 18-6q-6 2-8 6M92 84q-8-10-18-6q6 2 8 6M10 88q6-6 14-4M90 88q-6-6-14-4") + g(H, GROUND))

# Brâkmar : cité infernale, tours tordues, rivière de lave, ciel de fumée
zone('brakmar', '#e6a693', '#3e120e', '#5a1a14', '#ffb27a',
     g(Sw(1), "M12 22q6-6 12 0t12 0M60 14q6-6 12 0t12 0M40 30q4-4 8 0t8 0"),
     g(D, "M0 100V74L6 54L10 70L16 44L22 66L28 30L34 68L42 50L48 72H52L58 46L64 70L72 26L78 64L84 48L90 70L96 52L100 64V100Z"),
     g(F, "M0 92q12-4 24 0t24 0t24 0t28 0V96q-14 4-28 0t-24 0t-24 0t-24 0Z") + g(H, "M0 100V96q12 4 24 0t24 0t24 0t28 0V100Z") + g(Sw(1.2), "M14 90l2-6M70 90l2-5M44 91l1-4"))

# Plaines de Cania : plaines rocailleuses, menhirs des Dents de Pierre, corbeaux
zone('plaines-de-cania', '#efe2c2', '#a8936a', '#7d6d4e', '#3a2c1e',
     g(S, bird(20, 18, 3) + bird(30, 24, 2.2) + bird(74, 16, 2.6)),
     g(H, "M0 76L12 66L26 70L40 58L58 66L72 56L88 64L100 60V100H0Z"),
     g(H, GROUND) + g(D, "M10 88l2-24h7l2 24ZM26 88l1-14h6l1 14ZM62 88l2-30h5l2 30ZM74 88l2-30h5l2 30ZM88 88l1-16h6l1 16Z") + g(D, "M60 58h23v-5H60Z"))

# Île de Frigost : aurore boréale, pics de glace, sapins gelés
zone('ile-de-frigost', '#d8ecf8', '#86b3d6', '#5b8fbf', '#b9f2e0',
     g(Sw(1.2), "M0 22q20-12 40 0t40-4t20 2M0 30q24-10 46 0t54-6") + g(F, star(16, 10, 1.4) + star(84, 12, 1.2) + star(60, 8, 1)),
     g(H, "M0 78L14 50L22 62L34 34L46 60L56 44L70 64L82 38L92 58L100 52V100H0Z") + g(F, "M30 41L34 34L39 42L36 40L34 44L32 40ZM78 45L82 38L86 45L82 43ZM12 54L14 50L17 55L14 53Z"),
     "".join(g(H, pine(x, b, h, w)) for x, b, h, w in [(10, 92, 28, 8), (22, 94, 20, 6), (82, 92, 32, 9), (94, 94, 18, 5)]) + g(F, "M10 64l2 3h-4ZM82 60l2 3h-4Z") + g(S, "M50 90h20M46 94h28"))

# Île de Nowel : sapin décoré et son étoile, maisonnette, cadeaux, neige
zone('ile-de-nowel', '#eef4fb', '#b84a4a', '#3f6a4a', '#ffffff',
     g(F, "".join(circ(x, y, .9) for x, y in [(10, 12), (24, 24), (40, 10), (58, 20), (72, 8), (88, 22), (16, 34), (82, 36), (50, 30)])),
     g(H, "M60 100V74h24V100Z") + g(D, "M56 74l16-12 16 12Z") + g(H, "M78 66v-6h3v8Z") + g(F, "M66 82h5v5h-5Z"),
     g(H, pine(24, 92, 44, 15)) + g(F, star(24, 47, 3.2) + circ(18, 70, 1.2) + circ(30, 76, 1.2) + circ(22, 82, 1.2) + circ(28, 64, 1.2)) + g(D, "M40 94v-8h8v8ZM50 94v-6h6v6Z") + g(S, "M44 86v8M40 90h8M53 88v6"))

# Île d'Otomaï : l'arbre Hakam géant, la jungle, la plage de corail
zone('ile-d-otomai', '#c4ebd2', '#2f7d55', '#2c6a4a', '#ffffff',
     g(S, bird(18, 20, 2.4) + bird(84, 14, 2.4)),
     g(D, "M42 100q4-20 1-44h14q-3 24 3 44Z") + g(H, circ(50, 34, 20) + circ(30, 44, 13) + circ(70, 44, 13) + circ(50, 18, 12)) + g(S, "M44 70q-10 8-18 4M56 72q10 6 18 2M48 86q-6 6-12 6"),
     g(Sw(1.6), "M8 100q2-14-1-28M92 100q-3-16 2-30") + g(Sw(1), "M7 72q-6-2-10 4M7 72q-4-6-10-5M7 72q3-7 9-7M7 72q7 0 9 5M94 70q6-2 10 4M94 70q4-6 10-5M94 70q-3-7-9-7M94 70q-7 0-9 5")
     + g(D, "M22 96q2-6 4 0q2-8 4 0q2-5 4 0ZM66 96q2-7 4 0q2-5 4 0Z"))

# Landes de Sidimote : terres dévastées, crevasses, champignons géants, lune morte
zone('landes-de-sidimote', '#c9b8a6', '#4a3a30', '#5a4636', '#e8d6b8',
     g(H, circ(78, 18, 8)) + g(S, "M72 14l4 3M80 22l3-2"),
     g(H, "M0 76L18 70L30 74L46 64L62 72L78 66L100 72V100H0Z") + g(D, "M34 72q-2-14 4-18q10 2 8 10q-6 2-8 8Z"),
     g(Sw(1.8), "M14 100V70l-8-10M14 76l9-10 4-7M14 70l2-12") + g(D, "M70 92q-2-10 2-12h4q4 2 2 12ZM64 80q8-12 20 0Z") + g(Sw(.9), "M30 92l6-4 4 4 6-6M52 96l5-4 6 3") + g(H, GROUND))

# Montagne des Koalaks : montagnes, grands eucalyptus (Kaliptus), totem primitif
zone('montagne-des-koalaks', '#dcecd0', '#7b8a4c', '#5d6e3c', '#ffffff',
     g(H, circ(22, 18, 4) + circ(28, 15, 5) + circ(34, 18, 3.5)),
     g(H, "M0 74L16 44L26 58L40 30L56 56L68 42L84 60L100 46V100H0Z"),
     g(Sw(1.5), "M10 100V56M10 70l-5-6M10 64l6-8M90 100V50M90 66l6-6M90 58l-6-8") + g(H, ell(8, 54, 6, 8) + ell(14, 48, 5, 6) + ell(90, 46, 7, 9) + ell(84, 54, 5, 6))
     + g(D, "M44 96V74h8V96Z") + g(F, "M45 77h2v2h-2ZM49 77h2v2h-2ZM45 84h6v2h-6Z") + g(D, "M42 74h12l-6-6Z"))

# Île de Pandala : pagode, pont de bois, cerisiers et pétales, grande lune
zone('ile-de-pandala', '#f6e2d6', '#7aa05a', '#a04a3a', '#f08aa6',
     g(H, circ(78, 18, 8)) + g(Sw(1.2), "M0 8q14 2 26 14q6 6 10 8M12 11q0 6 4 9M24 20q4-1 8 2") + g(F, flower(16, 22) + flower(26, 14) + flower(34, 28) + flower(8, 14) + flower(20, 30) + "".join(petal(x, y, 1.1) for x, y in [(44, 36), (52, 24), (40, 46), (58, 40)])),
     tr(g(D, "M40 100V76h20V100ZM33 76h34l-7-6H40ZM42 70V62h16v8ZM36 62h28l-6-5H42ZM44 57v-7h12v7ZM39 50h22l-11-9Z") + g(S, "M50 41v-5"), 42, 20, .8) + g(Sw(1.6), "".join(f"M{x} 100V{t}" for x, t in [(6, 40), (12, 50), (18, 44)])) + g(Sw(.8), "M4 52h4M10 62h4M16 58h4M6 70h4M12 78h4"),
     g(Sw(1), "M30 92q20-12 40 0M32 92v5M68 92v5M40 87v10M60 87v10") + g(H, GROUND))

# Archipel de Vulkania : volcan fumant, mer au couchant, palmiers
zone('archipel-de-vulkania', '#f8c690', '#7a3a22', '#8a3a24', '#ffe0a0',
     g(H, "M50 30a14 14 0 0 1 28 0Z") + g(S, "M46 34h36M50 38h28"),
     g(D, "M6 82L34 44H46L74 82Z") + g(Sw(1), "M38 40q-6-6 0-12t0-12M44 38q5-5 0-10t2-10") + g(F, "M36 46l2 12 3-7 2 14 3-19Z"),
     g(Sw(1.6), "M88 100q-3-16 2-30") + g(Sw(1), "M90 70q6-2 10 4M90 70q4-6 10-5M90 70q-3-7-9-7M90 70q-7 0-9 5") + g(S, waves(88, 2, 1.5, 5, 0, 7)))

# Île de Moon : île-tortue, masques tiki des Kanniboul, plage et palmiers
zone('ile-de-moon', '#fbe0ae', '#3e9a8f', '#2f7a6a', '#ffffff',
     g(H, circ(22, 20, 7)) + g(S, "M10 30q6-2 12 0"),
     g(D, "M24 74q26-30 52 0Z") + g(S, "M34 70l8-10 8 6 8-8 8 10M50 52v10") + g(H, "M70 72l8-4 4 6Z") + g(S, waves(80, 2, 1.5, 5)),
     g(D, "M6 96V66h12V96Z") + g(F, "M8 72h3v3H8ZM13 72h3v3h-3ZM9 80h6v2H9Z") + g(D, "M84 96V62h12V96Z") + g(F, "M86 68h3v4h-3ZM91 68h3v4h-3ZM87 78h6v3h-6Z")
     + g(Sw(.8), "M4 66h16M82 62h16M6 62l6-4 6 4M84 58l6-5 6 5"))

# Forêt des Abraknydes : futaie sombre aux troncs noueux, mousse et lucioles
zone('foret-des-abraknydes', '#a9c09a', '#24391f', '#2c4a2a', '#f6f0a0',
     g(F, "".join(circ(x, y, .9) for x, y in [(30, 30), (44, 40), (62, 26), (70, 44), (20, 50)])),
     "".join(g(H, pine(x, b, h, w)) for x, b, h, w in [(30, 76, 30, 8), (46, 74, 36, 9), (62, 76, 30, 8), (74, 78, 24, 7)]),
     g(D, "M0 100V30q6-4 12 0V60q4 20 2 40ZM100 100V24q-7-4-14 0V58q-4 22-2 42Z") + g(F, ell(6, 46, 1.4, 1) + ell(10, 46, 1.4, 1) + ell(92, 42, 1.4, 1) + ell(96, 42, 1.4, 1))
     + g(Sw(1), "M8 54q0 3 3 3M93 50q0 3-3 3M12 40q6-6 10-4M88 36q-6-6-10-4"))

# Forêt des Abraknydes ne doit pas être confondue avec la Forêt Maléfique : château, citrouilles, chauves-souris
zone('foret-malefique', '#e4b892', '#3e2232', '#3a1e2e', '#ffe2a0',
     g(H, circ(78, 20, 8)) + g(S, bird(30, 18, 3) + bird(40, 26, 2.4) + bird(58, 14, 2.6)),
     g(D, "M26 100V56h8V48l3-6 3 6v8h12V40l4-8 4 8v16h10V100Z") + g(F, "M42 64h3v4h-3ZM58 52h3v5h-3Z"),
     g(Sw(1.8), "M10 100V72l-6-8M10 78l7-8") + g(D, "M60 94a10 8 0 0 1 20 0ZM82 94a7 6 0 0 1 14 0Z") + g(F, "M64 88l2-2 2 2ZM72 88l2-2 2 2ZM66 92h8l-2-1h-4Z") + g(H, GROUND))

# Île des Wabbits : carottes géantes, terriers, château du Wa Wabbit
zone('ile-des-wabbits', '#e6f4d4', '#c77a2e', '#d07a2a', '#ffffff',
     g(H, circ(20, 18, 5) + circ(27, 15, 6) + circ(33, 19, 4)),
     g(H, "M58 100V66h6v-6h4v6h8v-6h4v6h6V100Z") + g(D, "M62 60l4-8 4 8ZM74 60l4-8 4 8Z") + g(S, "M64 52l-1-3M66 52l1-3M76 52l-1-3M78 52l1-3"),
     g(D, "M14 96l-5-34h10ZM34 98l-3-22h6Z") + g(Sw(1.1), "M14 62l-4-8M14 62l0-9M14 62l4-8M34 76l-3-6M34 76l3-6") + g(D, ell(50, 94, 6, 2.5)) + g(H, GROUND))

# Incarnam : île flottante au-dessus des nuages, cascade, statue des dieux
zone('incarnam', '#f6f0ff', '#b6a6e2', '#8f7cc8', '#ffffff',
     g(H, circ(12, 24, 5) + circ(19, 21, 6) + circ(26, 25, 4) + circ(80, 16, 5) + circ(87, 13, 6)),
     g(D, "M24 56H76L66 70L54 86L48 74L38 70Z") + g(S, "M26 56q4-4 8 0q4-4 8 0q4-4 8 0q4-4 8 0q4-4 8 0q4-4 8 0") + g(Sw(1), "M68 58v20M70 58v16") + g(H, "M46 56V40h8V56ZM44 40h12l-6-6Z"),
     g(H, circ(10, 90, 7) + circ(20, 88, 8) + circ(32, 92, 6) + circ(70, 92, 6) + circ(80, 88, 8) + circ(92, 91, 7)))

# Saharach : dunes, pyramide maudite, squelette de mastodonte, soleil écrasant
zone('saharach', '#fde2ac', '#d39a4e', '#b07a36', '#fff2c0',
     g(S, circ(78, 20, 8) + "M78 6v-3M78 34v3M64 20h-3M92 20h3M68 10l-2-2M88 30l2 2M88 10l2-2M68 30l-2 2"),
     g(H, "M0 78Q25 64 50 74T100 66V100H0Z") + tr(g(D, "M30 76L50 46L70 76Z") + g(S, "M50 46L54 76"), 40, 12, .85) + g(D, "M56 76L64 64L72 76Z"),
     g(Sw(1.4), "M6 94q4-14 14-16M12 94q2-10 10-12M18 94q0-8 8-8M24 94q-1-6 6-6") + g(Sw(1.6), "M6 78q10-6 26 2") + g(H, "M60 100V88q10-8 22 0v12Z"))

# Dimensions des Cavaliers : terre fendue, épées plantées, ciel de fin du monde
zone('dimensions-des-cavaliers', '#e4a08c', '#4a1612', '#5a1c16', '#ffd0a0',
     g(Sw(1), "M0 20q20 8 40 0t30 6t30-4M10 32q24 6 50-2t40 4"),
     g(D, "M8 100V60h7l1-6 2 6h4V100ZM78 100V50h9V100Z") + g(S, "M30 100V72a20 20 0 0 1 40 0V100") + g(H, "M78 50l4-6 5 5Z"),
     g(H, GROUND) + g(Sw(.9), "M20 90l6-4 2 4 8-6M60 92l8-6 4 4") + g(D, "M44 90l1-20h2l1 20ZM40 74h12v2H40ZM84 92l1-16h2l1 16ZM81 78h10v2H81Z"))

# Île de Grobe : île des esprits, torii, tombes à lanternes, feux follets
zone('ile-de-grobe', '#d8d2ea', '#4a4566', '#3c3858', '#c8f0ff',
     g(F, circ(20, 28, 1.6) + circ(70, 22, 1.4) + circ(84, 36, 1.8)) + g(S, "M20 28q-3-6 0-10M70 22q3-5 0-9M84 36q-3-6 0-10"),
     g(D, "M14 42h72v4H14ZM20 52h60v3H20Z") + g(D, "M26 46v42h4V46ZM70 46v42h4V46Z") + g(S, "M12 42q38-6 76 0"),
     g(H, GROUND) + g(D, "M8 88V76a5 5 0 0 1 10 0V88ZM84 88V72a6 6 0 0 1 12 0V88Z") + g(D, "M40 88v-6h-3l5-4 5 4h-3v6Z") + g(F, "M41 84h2v2h-2Z"))

# Sanctuaire des Jardins éternels : arches végétales, fontaine, fleurs
zone('sanctuaire-des-jardins-eternels', '#f2ebcf', '#8fae6a', '#6f8f4e', '#ffffff',
     g(F, "".join(petal(x, y, 1.2) for x, y in [(20, 20), (36, 12), (64, 18), (82, 26)])),
     g(H, "M8 100V40h8V100ZM84 100V40h8V100Z") + g(S, "M12 40q38-34 76 0M12 46q38-30 76 0") + g(Sw(.8), "".join(f"M{x} {44 + abs(50-x)*.5:.0f}q2 3 0 6" for x in range(16, 86, 7))),
     g(D, "M38 92h24v-4H38ZM46 88V76h8V88ZM40 76h20v-3H40Z") + g(Sw(1), "M50 72q-6-8-10 0M50 72q6-8 10 0M50 72v-6")
     + g(F, circ(14, 90, 2) + circ(24, 92, 1.6) + circ(78, 91, 2) + circ(88, 89, 1.6)))

# Baie de Sufokia : phare blanc, port, vagues
zone('baie-de-sufokia', '#cdeaf6', '#2f86a8', '#2a6f8f', '#ffffff',
     g(S, bird(24, 16, 2.6) + bird(34, 22, 2) + bird(60, 12, 2.2)),
     g(D, "M70 82L74 40H82L86 82Z") + g(F, "M73 40h10l-5-6Z") + g(S, "M72 52h12M71 64h14M78 34l-14-6M78 34l14-6") + g(H, "M86 82V70h14V82Z"),
     g(S, waves(80, 3, 2, 6)) + g(D, "M8 78h26l-4 6H12Z") + g(S, "M20 78V58") + g(H, "M20 60l10 14H20Z"))

# Profondeurs de Sufokia : cité engloutie, colonnes, tentacule, bulles
zone('profondeurs-de-sufokia', '#4d93b6', '#0a2a46', '#0e3a5a', '#bfe8ff',
     g(H, "M28 0L22 50H32L38 0ZM62 0L60 40H68L72 0Z") + g(S, circ(50, 30, 2) + circ(54, 20, 1.4) + circ(47, 12, 1)),
     g(D, "M24 100V60h6V100ZM40 100V54h6V100ZM56 100V54h6V100ZM72 100V60h6V100Z") + g(D, "M20 60l31-14 31 14Z") + g(H, "M80 100V80l6-6 4 6V100Z"),
     g(Sw(2), "M6 100q-4-12 4-20t2-18q-2-8 4-10") + g(Sw(1.2), "M94 100q-4-10 0-20t0-22M88 100q4-8 0-14") + g(F, circ(10, 62, 1) + circ(13, 70, 1) + circ(12, 78, 1)))

# Gouffre du Gigalodon : abysse, mâchoire géante, falaise noyée
zone('gouffre-du-gigalodon', '#3a7290', '#061a2e', '#0a2a44', '#bfe8ff',
     g(S, circ(30, 20, 1.6) + circ(34, 12, 1.2) + circ(70, 26, 1.4)),
     g(D, "M10 70q40-34 80 0q-40-14-80 0Z") + g(F, "".join(f"M{x} {62 - abs(50 - x) * .25:.1f}l2 5 2-5Z" for x in range(22, 78, 6))) + g(F, circ(66, 54, 1.4)),
     g(D, "M0 100V60L10 70L8 84L16 100ZM100 100V54L90 66L94 80L86 100Z") + g(Sw(1.2), "M40 100q-4-10 0-18M60 100q4-10 0-16"))

# Écaflipus : dimension du dieu-chat, cartes à jouer, dés, roue de la fortune
zone('ecaflipus', '#f5dcb2', '#a8452e', '#8a3424', '#ffffff',
     g(S, circ(50, 22, 12) + circ(50, 22, 3) + "".join(f"M{50+3*math.cos(a):.1f} {22+3*math.sin(a):.1f}L{50+12*math.cos(a):.1f} {22+12*math.sin(a):.1f}" for a in [i * math.pi / 4 for i in range(8)])),
     g(D, "M14 84l6-30 16 3-6 30ZM30 86l10-28 15 5-10 28ZM64 86l-4-30 16-2 4 30Z") + g(F, "M22 66c-1-3 4-3 3 0-1 3-3 4-3 4s-1-1-3-4c-1-3 4-3 3 0ZM46 70l3 4-3 4-3-4ZM68 66l2 3 2-3-2-3Z"),
     g(D, "M10 96l10-5 8 9-10 5ZM78 96l8-10 10 5-8 10Z") + g(F, circ(18, 96, 1) + circ(86, 94, 1) + circ(90, 98, 1)) + g(H, GROUND))

# Enutrosor : galeries d'or, wagonnet, pioche, trésor
zone('enutrosor', '#f6e09c', '#8a6216', '#7a5212', '#fff2b0',
     g(D, "M0 0H100V8L94 22L88 8L80 28L72 8L64 18L56 8L48 26L40 8L32 20L24 8L16 26L8 8L0 14Z"),
     g(D, "M14 100V60h6V100ZM80 100V60h6V100Z") + g(D, "M10 60h80v-5H10Z") + g(S, "M0 92H100M0 96H100" + "".join(f"M{x} 90v8" for x in range(4, 100, 8))),
     g(D, "M36 88h28l-3-12H39Z") + g(F, circ(44, 74, 3) + circ(51, 72, 3.4) + circ(57, 75, 2.8) + circ(40, 90, 2) + circ(60, 90, 2))
     + g(Sw(1.4), "M76 86l12-14M80 70q6 0 10 6"))

# Srambad : cité des ombres, toits gothiques, lune, chauves-souris, crânes
zone('srambad', '#b8adcc', '#241c36', '#2a2040', '#efe6ff',
     g(S, "M22 12a9 9 0 1 0 9-9a7 7 0 1 1-9 9Z") + g(F, "M60 20l3-2 2 2 2-2 3 2-4 1-1 2-1-2ZM76 30l2-1.5 1.5 1.5 1.5-1.5 2 1.5-3 1-1 1.5-1-1.5Z"),
     g(D, "M0 100V70l6-12 6 12V62l8-18 8 18v8h6V54l8-22 8 22v16h6V60l8-16 8 16V72h6l6-14 6 14V100Z") + g(F, "M42 60h3v5h-3ZM58 70h2v4h-2ZM18 72h2v4h-2Z"),
     g(H, GROUND) + g(D, circ(16, 86, 4)) + g(F, circ(14.5, 85.5, 1) + circ(17.5, 85.5, 1)) + g(D, circ(84, 88, 3.4)) + g(F, circ(82.8, 87.6, .8) + circ(85.2, 87.6, .8)))

# Xélorium : dimension du temps, sablier géant, engrenages, cadran
zone('xelorium', '#d4e2e8', '#3e5e6e', '#3e6070', '#ffffff',
     g(S, circ(50, 22, 14) + "M50 22V12M50 22l7 4" + "".join(f"M{50+12*math.cos(a):.1f} {22+12*math.sin(a):.1f}l{1.6*math.cos(a):.1f} {1.6*math.sin(a):.1f}" for a in [i * math.pi / 6 for i in range(12)])),
     g(D, gear(16, 60, 12, 10)) + g(D, gear(86, 54, 10, 9)),
     g(D, "M38 96h24v-3H38ZM38 50h24v-3H38Z") + g(H, "M41 50q0 12 9 22q-9 10-9 21h18q0-11-9-21q9-10 9-22Z") + g(F, "M44 88l6-8 6 8ZM46 56h8l-4 6Z") + g(Sw(1.4), "M40 50v43M60 50v43"))

# Île de Pwâk : œufs en chocolat, temple du dieu Kao, rivière de crème
zone('ile-de-pwak', '#f4dcc0', '#6b3e22', '#7a4628', '#ffffff',
     g(H, circ(20, 18, 5) + circ(27, 15, 6)),
     g(D, "M58 100V64h28V100Z") + g(D, "M54 64l18-14 18 14Z") + g(F, "M68 76h8v24h-8Z") + g(H, "M0 76Q30 66 54 74V100H0Z"),
     g(D, "M14 92c-7 0-9-9-7-16s7-12 7-12 7 5 7 12-0 16-7 16ZM34 94c-5 0-7-7-5-12s5-9 5-9 5 4 5 9-0 12-5 12Z") + g(F, "M8 78l3-2 3 2 3-2 3 2v1.6l-3-2-3 2-3-2-3 2ZM30 84l2-1.5 2 1.5 2-1.5 2 1.5v1.4l-2-1.5-2 1.5-2-1.5-2 1.5Z")
     + g(Sw(1.2), "M44 98q10-4 20 0t20 0t16 0"))

# Archipel de Valonia : forteresse taillée dans la montagne, forêt de résineux
zone('archipel-de-valonia', '#d6e2c6', '#4a6646', '#4e6648', '#ffffff',
     g(S, bird(70, 14, 2.4) + bird(78, 20, 2)),
     g(H, "M0 80L20 40L36 58L52 28L70 54L84 38L100 60V100H0Z") + g(D, "M40 70V52h6v-4h4v4h6v-4h4v4h6V70Z") + g(S, crenel(40, 66, 52, 1.5, 1.5)) + g(F, "M50 62a3 3 0 0 1 6 0v8h-6Z"),
     "".join(g(H, pine(x, b, h, w)) for x, b, h, w in [(8, 94, 26, 7), (20, 96, 18, 5), (88, 94, 28, 8), (78, 96, 16, 5)]))

# Île du Minotoror : labyrinthe de pierre, cornes de taureau
zone('ile-du-minotoror', '#ead6b2', '#8a5a34', '#6e4628', '#3a2c1e',
     g(Sw(1.6), "M36 24q-8-14 6-18M64 24q8-14-6-18") + g(D, "M36 24q14 10 28 0q-2 10-14 10t-14-10Z"),
     g(H, "M0 78L20 68L36 72L54 62L74 70L100 64V100H0Z"),
     g(D, "M0 100V72H40V78H8V92H32V86H16V82H40V100ZM60 100V72H100V78H68V86H92V100H86V92H74V100Z"))

# Osavora : savane, acacias, œuf de dragon géant, grand soleil
zone('osavora', '#f8dca0', '#b0832f', '#8a6424', '#fff0c0',
     g(H, "M30 40a20 20 0 0 1 40 0Z"),
     g(H, "M0 76Q30 66 60 72T100 68V100H0Z") + g(D, "M50 70c-7 0-10-8-8-16s8-14 8-14 8 6 8 14-1 16-8 16Z") + g(Sw(.8), "M44 56l3 2 3-2 3 2 3-2"),
     g(Sw(1.8), "M14 100V72l-6-8M14 76l8-10M88 100V70l6-8M88 74l-8-10") + g(D, "M0 64q14-8 30 0ZM72 62q14-8 28 0Z") + g(Sw(.8), "".join(f"M{x} 96q1-5-1-8" for x in range(30, 72, 5))))

# Wukin et Wukang : royaumes d'encre et de papier, montagnes au lavis, pinceau
zone('wukin-et-wukang', '#f4efe2', '#3a3a3a', '#2a2a2a', '#c23b2b',
     g(F, "M76 10h10v10H76Z") + g("fill='none' stroke='#000' stroke-width='.8'", "M78 13h6M78 16h6M81 12v7"),
     g(D, "M0 70Q8 40 18 56Q26 30 38 50Q46 24 58 58Q66 44 74 62Q84 36 100 66V100H0Z") + g(S, "M0 80q30-6 60 0t40-2"),
     g(Sw(2.2), "M12 100V58M20 100V66") + g(Sw(.8), "M12 64q6-2 10 2M12 72q-6 0-8 4M20 70q6-2 9 2") + g(D, "M60 94l22-22 4 4-22 22Z") + g(F, "M60 94l-4 4 6-2Z"))

# Île de Sakaï : plaine enneigée, entrée de mine abandonnée, rails
zone('ile-de-sakai', '#e6eff6', '#8aa3b8', '#6a8299', '#ffffff',
     g(F, "".join(circ(x, y, .8) for x, y in [(14, 14), (30, 26), (48, 10), (66, 22), (86, 14), (20, 40), (78, 38)])),
     g(H, "M0 76L22 46L34 60L52 36L70 58L86 48L100 64V100H0Z") + g(F, "M48 42l4-6 4 6-2-1-2 2-2-2Z"),
     g(D, "M30 96V74a20 18 0 0 1 40 0V96H62V76a12 10 0 0 0-24 0V96Z") + g(S, "M40 98l-10 0M44 90l-16 10M56 90l16 10" + "".join(f"M{36+i*7 - i*2} {92+i*2.4:.1f}h{28 - i*4 + 8*i/2}" for i in range(3))))

# Dimension obscure : pyramide d'ombre, œil, étoiles noires
zone('dimension-obscure', '#9c90b6', '#1a1428', '#241c36', '#e6d8ff',
     g(F, star(16, 18, 2) + star(84, 14, 1.6) + star(70, 34, 1.2) + star(28, 36, 1.2)),
     g(D, "M20 84L50 34L80 84Z") + g(F, ell(50, 58, 7, 4)) + g("fill='#000'", circ(50, 58, 2.4)),
     g(H, GROUND) + g(Sw(1), "M10 84q-4-8 2-14M90 84q4-8-2-14"))

# Nimotopia : royaume du rêve, bulles flottantes, nuages et étoiles
zone('nimotopia', '#ebe2fb', '#8a7ac8', '#7a68b8', '#ffffff',
     g(S, circ(20, 20, 6) + circ(34, 30, 3) + circ(70, 16, 7) + circ(84, 30, 3.4)) + g(F, star(52, 14, 1.6)),
     g(H, circ(20, 70, 8) + circ(30, 66, 10) + circ(42, 72, 7) + circ(64, 68, 8) + circ(76, 64, 10) + circ(88, 70, 7)),
     g(D, "M44 96l6-20 6 20ZM40 84h20v-2H40Z") + g(F, star(50, 72, 2.4)))

# Archipel des Écailles : marais à crocodiles, roseaux, carapace du sanctuaire de Torkélonia
zone('archipel-des-ecailles', '#cfe2c6', '#3e6a52', '#3a5e4a', '#ffffff',
     g(S, bird(70, 16, 2.4) + bird(80, 22, 2)),
     g(D, "M44 74q18-28 40 0Z") + g(S, "M50 70l6-10 8 6 8-6 6 10M64 56v10"),
     g(S, waves(84, 3, 1.5, 5)) + g(D, "M20 82q4-4 8 0ZM30 82q4-4 8 0Z") + g(F, circ(24, 80.5, .9) + circ(34, 80.5, .9)) + g(Sw(1.2), "M6 90V60M10 90V66M90 90V58M94 90V64") + g(F, "M5 60h2v8H5ZM89 58h2v8h-2Z"))

# Atoll des Possédés : port des pirates Ravageurs, navire au pavillon noir
zone('atoll-des-possedes', '#c8d2de', '#24384c', '#24384c', '#ffffff',
     g(H, circ(20, 18, 6)) + g(S, "M8 30q10-4 20 0M14 36q8-3 14 0"),
     g(D, "M30 76h44l-6 8H36Z") + g(Sw(1), "M52 76V34M42 76V46") + g(H, "M52 38l16 14H52ZM52 54l14 12H52ZM42 48l-10 12h10Z") + g(D, "M52 34h10v6H52Z") + g(F, circ(57, 37, 1.4)),
     g(S, waves(88, 2, 2, 5)) + g(Sw(1.6), "M90 100q-3-14 2-26") + g(Sw(1), "M92 74q6-2 8 4M92 74q4-6 8-4M92 74q-4-5-8-4"))

# Cauchemar des Ravageurs : brume pourpre, spirales, yeux dans le noir
zone('cauchemar-des-ravageurs', '#c69cc8', '#2e0e38', '#3a1446', '#ffd0ff',
     g(S, "M30 22m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 0a5 5 0 1 1 9 0a8 8 0 1 1-14 0") + g(S, "M74 30m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-5 0a5 5 0 1 1 9 0"),
     g(D, "M0 100V80L8 62L12 76L20 50L26 72L34 40L40 74L50 54L56 76L66 36L72 72L80 58L86 76L94 52L100 72V100Z"),
     g(F, ell(20, 84, 3, 1.4) + ell(30, 84, 3, 1.4) + ell(70, 88, 2.4, 1.2) + ell(78, 88, 2.4, 1.2)) + g("fill='#000'", circ(20, 84, .8) + circ(30, 84, .8)) + g(H, "M0 100V92q50-6 100 0V100Z"))

# Gelaxième dimension : gelées géantes, planètes et anneaux
zone('gelaxieme-dimension', '#f2d6f2', '#6a8fd0', '#7a6ad0', '#ffffff',
     g(H, circ(24, 20, 7)) + g(S, ell(24, 20, 12, 3)) + g(F, star(70, 14, 1.6) + star(84, 30, 1.2) + star(56, 30, 1)),
     g(D, "M10 84a14 16 0 0 1 28 0ZM62 84a18 20 0 0 1 36 0Z"),
     g(F, circ(18, 76, 1.4) + circ(28, 76, 1.4) + circ(72, 72, 1.8) + circ(86, 72, 1.8)) + g(Sw(.9), "M20 80q3 2 6 0M74 78q5 3 10 0") + g(H, "M42 84a6 7 0 0 1 12 0Z"))

# Îlots de la mer d'Asse : théâtre de Dramak, rideau, masques
zone('ilots-de-la-mer-d-asse', '#f2dac2', '#7a3a3a', '#7a2a2a', '#ffffff',
     g(D, "M0 0H100V6Q80 16 70 6Q60 18 50 6Q40 18 30 6Q20 16 0 6Z"),
     g(D, "M0 0V96Q8 60 12 6ZM100 0V96Q92 60 88 6Z") + g(H, "M14 96H86V88H14Z"),
     g(D, "M34 60a9 10 0 0 0 18 0q0-8-9-8t-9 8ZM54 64a9 10 0 0 0 18 0q0-8-9-8t-9 8Z") + g(F, "M38 58h3v2h-3ZM45 58h3v2h-3ZM39 64q4 3 8 0M58 62h3v2h-3ZM65 62h3v2h-3ZM59 70q4-3 8 0"))

# Labyrinthe du Dragon Cochon : souterrain, murs du dédale, torches
zone('labyrinthe-du-dragon-cochon', '#e4c8a6', '#5a2e16', '#5a3018', '#ffc070',
     g(D, "M0 0H100V8L92 20L86 8L76 24L68 8L58 16L50 8L40 22L32 8L22 18L14 8L6 20L0 12Z"),
     g(D, "M0 100V60H30V66H8V80H24V74H14V70H30V100ZM70 100V60H100V100H92V68H78V86H86V92H70Z"),
     g(Sw(1.4), "M44 96V82M56 96V82") + g(F, "M44 82q-3-5 0-9q3 4 0 9ZM56 82q-3-5 0-9q3 4 0 9Z"))

# Foire du Trool : chapiteau rayé, grande roue, fanions
zone('foire-du-trool', '#f6dec4', '#8a3a6a', '#7a2a5a', '#ffffff',
     g(Sw(.8), "M0 14q25 10 50 0t50 0") + g(F, "".join(f"M{x} {14 + 4*math.sin((x/50)*math.pi):.1f}l2 5 2-5Z" for x in range(4, 100, 9))),
     g(S, circ(76, 50, 18) + circ(76, 50, 3) + "".join(f"M76 50L{76+18*math.cos(a):.1f} {50+18*math.sin(a):.1f}" for a in [i * math.pi / 4 for i in range(8)]) + "M70 86l6-36 6 36"),
     g(D, "M8 92L34 54L60 92Z") + g(S, "M34 54L26 92M34 54L42 92M34 54L18 92M34 54L50 92M34 54V46") + g(F, "M34 46l6 2-6 2Z"))

# ---------------------------------------------------------------- autres séries
zone('atelier', '#ece0c6', '#8a6a40', '#6a4a24', '#ffffff',
     g(D, "M0 0H100V6Q80 16 70 6Q60 18 50 6Q40 18 30 6Q20 16 0 6Z"),
     g(D, "M0 0V96Q8 60 12 6ZM100 0V96Q92 60 88 6Z"),
     g(D, "M30 96h40v-4H30ZM36 92V86h28v6Z"))
zone('temple', '#efe2c0', '#a07a40', '#7a5a2a', '#ffffff',
     g(S, "M0 22L50 4L100 22"),
     g(D, "M6 100V30h10V100ZM84 100V30h10V100Z") + g(D, "M3 30h16v-4H3ZM81 30h16v-4H81Z"),
     g(S, circ(50, 56, 34) + circ(50, 56, 30)))
zone('krosmoz', '#3a2a6a', '#120c2a', '#5a4aa0', '#ffffff',
     g(F, "".join(star(x, y, r) for x, y, r in [(14, 18, 2.6), (30, 34, 1.4), (78, 14, 2.4), (88, 40, 1.4), (60, 24, 1.2), (20, 60, 1.2), (82, 72, 1.8)])) + g(S, "M14 18L30 34L60 24L78 14L88 40"),
     g(H, ell(50, 56, 40, 12)),
     g(S, "M50 50m-2 0a2 2 0 1 1 4 0a5 5 0 1 1-9 0a8 8 0 1 1 15 0a12 12 0 1 1-22 0a16 16 0 1 1 29 0"))
zone('el-feu', '#f8c08a', '#c2421e', '#a0301a', '#ffe0a0',
     g(F, circ(30, 30, 1) + circ(60, 20, 1.2) + circ(74, 34, .9)),
     g(D, "M14 100q-10-16 0-34q2 10 6 12q2-10-2-20q14 12 8 42ZM86 100q10-16 0-34q-2 10-6 12q-2-10 2-20q-14 12-8 42Z"),
     g(H, "M44 100q-6-8 2-18q0 6 4 6q2-6 0-12q8 10 2 24Z"))
zone('el-eau', '#bfe2f6', '#2d72b8', '#2a5f9a', '#ffffff',
     g(F, "M20 20q-3 5 0 7q3-2 0-7ZM80 14q-3 5 0 7q3-2 0-7Z"),
     g(S, waves(66, 3, 3, 7)),
     g(Sw(1.6), "M0 94q12-8 24 0t24 0t24 0t28 0"))
zone('el-terre', '#dcc49a', '#7a5a2e', '#6a4a24', '#ffffff',
     g(S, "M10 24l6-4M84 20l4 4"),
     g(D, "M8 92l4-20 6-6 6 8 2 18ZM76 92l2-24 8-10 6 14v20Z"),
     g(H, "M58 94l2-10 6-4 4 6v8Z") + g(H, GROUND))
zone('el-air', '#e2f2d6', '#5f9f6a', '#4a8a5a', '#ffffff',
     g(S, "M6 30h40a6 6 0 1 0-6-6M56 20h34"),
     g(S, "M10 46h56a8 8 0 1 1-8 8M20 64h30a5 5 0 1 0-5-5"),
     g(S, "M60 80h32a6 6 0 1 1-6 6"))
zone('el-neutre', '#e2dccf', '#6f685e', '#5a544c', '#ffffff',
     g(S, "M50 10v6M50 84v6M10 50h6M84 50h6"),
     g(S, circ(50, 50, 40) + circ(50, 50, 34)),
     g(S, "M22 22l4 4M78 78l-4-4M78 22l-4 4M22 78l4-4"))


def uri(s): return 'url("data:image/svg+xml,' + quote(s, safe="=:/ '") + '")'

out = ["/* Décors des cartes du Bestiaire, un par zone d'origine. Généré par scripts/scenes.py : ne pas modifier à la main. */"]
for z, (sky, ground, cfar, csky, sk, far, near) in Z.items():
    out.append(f".bc-scene.z-{z}{{--sky:{sky};--ground:{ground};--c-far:{cfar};--c-sky:{csky};"
               f"--m-sky:{uri(svg(sk))};--far:{uri(svg(far))};--near:{uri(svg(near))}}}")
path = os.path.join(os.path.dirname(__file__), '..', 'css', 'scenes.css')
open(path, 'w').write("\n".join(out) + "\n")
print(len(Z), 'zones,', sum(len(l) for l in out), 'octets')
