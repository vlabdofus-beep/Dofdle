# Génère le CSS des décors gravés par zone d'origine (cartes du Bestiaire)
import math, re
from urllib.parse import quote

def svg(body, hatch=True):
    pat = ("<defs><pattern id='h' width='2.2' height='2.2' patternUnits='userSpaceOnUse' patternTransform='rotate(38)'>"
           "<rect width='.8' height='2.2' fill='#fff'/></pattern></defs>")
    return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" + pat + body + "</svg>"

H = "fill='url(#h)' stroke='#fff' stroke-width='.6' stroke-linejoin='round'"   # silhouette gravée
def Sw(w): return f"fill='none' stroke='#fff' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round'"
S = Sw(.8)  # trait
F = "fill='#fff'"  # aplat

def g(attrs, d): return f"<path {attrs} d='{d}'/>"
def circ(x, y, r): return f"M{x-r} {y}a{r} {r} 0 1 0 {2*r} 0a{r} {r} 0 1 0 {-2*r} 0"
def star(x, y, r):
    return f"M{x} {y-r}L{x+r*.28} {y-r*.28}L{x+r} {y}L{x+r*.28} {y+r*.28}L{x} {y+r}L{x-r*.28} {y+r*.28}L{x-r} {y}L{x-r*.28} {y-r*.28}Z"
def pine(x, b, h, w):
    return f"M{x} {b-h}L{x+w*.55} {b-h*.55}H{x+w*.3}L{x+w} {b-h*.12}H{x+.8}V{b}H{x-.8}V{b-h*.12}H{x-w}L{x-w*.3} {b-h*.55}H{x-w*.55}Z"
def tree(x, b, r):
    return f"M{x-1} {b}V{b-r*1.2}" + circ(x, b - r * 1.9, r)[0:0] + f"H{x+1}V{b}Z" + circ(x, b - r * 1.9, r) + circ(x - r * .8, b - r * 1.4, r * .7) + circ(x + r * .8, b - r * 1.4, r * .7)
def gear(cx, cy, r, n):
    pts = []
    for i in range(n * 4):
        a = i / (n * 4) * 2 * math.pi
        rr = r if (i % 4) in (0, 1) else r * .8
        pts.append(f"{cx+rr*math.cos(a):.1f} {cy+rr*math.sin(a):.1f}")
    return "M" + "L".join(pts) + "Z" + circ(cx, cy, r * .35)
def waves(y0, rows, amp=3, step=7):
    d = ""
    for k in range(rows):
        y = y0 + k * step
        d += f"M0 {y}" + "".join(f"q{2.5} {-amp} 5 0t5 0" for _ in range(10))
    return d

GROUND = "M0 84Q50 80 100 84V100H0Z"
M = {
 'hills': g(H, "M0 74Q18 62 38 70T76 66T100 70V100H0Z") + g(S, "M0 84Q30 76 60 82T100 80"),
 'windmill': g(H, "M82 86L84 62H90L92 86Z") + g(F, "M83 62L87 56L91 62Z") + g(Sw(1.4), "M87 59L76 49M87 59L98 49M87 59L77 71M87 59L97 70") + g(H, "M6 88V78h10v10Z") + g(S, "M4 78l7-5 7 5"),
 'citytowers': g(H, "M6 100V64h8V56l4-7 4 7v8h6V72h10V60l5-9 5 9v12h8V66h6l3-6 3 6V100Z") + g(H, "M72 100V56l6-11 6 11V100Z") + g(S, "M78 45V40M50 51v-5M18 49v-4") + g(F, "M78 40l4 1.5-4 1.5ZM50 46l4 1.5-4 1.5Z"),
 'spires': g(H, "M0 100V80L8 62L12 76L20 50L26 72L34 40L40 74L50 54L56 76L66 36L72 72L80 58L86 76L94 52L100 72V100Z"),
 'stones': g(H, GROUND) + g(H, "M12 82l2-18h6l2 18ZM32 82l1-12h6l1 12ZM56 82l2-26h4l2 26ZM68 82l2-26h4l2 26ZM80 82l1-14h6l1 14Z") + g(H, "M54 56h22v-4H54Z"),
 'snowpeaks': g(H, "M0 78L18 50L28 62L46 30L62 58L74 44L100 74V100H0Z") + g(F, "M40 41L46 30L53 42L49 39L46 44L43 39ZM14 57L18 50L22 56L18 54ZM70 51L74 44L79 50L74 48Z") + g(S, "M10 30v5M7.5 32.5h5M24 22v4M22 24h4M90 26v5M87.5 28.5h5M70 18v4M68 20h4"),
 'peaks': g(H, "M0 76L14 56L24 66L40 36L54 60L66 46L82 62L100 50V100H0Z"),
 'lowpeaks': g(H, "M0 78L20 64L32 70L50 56L66 68L82 60L100 70V100H0Z"),
 'pines': "".join(g(H, pine(x, b, h, w)) for x, b, h, w in [(12, 88, 30, 8), (24, 90, 22, 6), (80, 88, 34, 9), (92, 90, 20, 6), (66, 92, 16, 5)]),
 'trees': "".join(g(H, tree(x, b, r)) for x, b, r in [(14, 90, 8), (86, 90, 9), (70, 92, 5)]),
 'palms': g(Sw(2), "M14 100q2-16-2-34M86 100q-3-18 3-36") + g(Sw(1.2), "M12 66q-8-2-12 4M12 66q-6-8-14-6M12 66q4-8 12-8M12 66q8 0 12 6M12 66q0-8 6-12M89 64q8-2 12 4M89 64q6-8 14-6M89 64q-4-8-12-8M89 64q-8 0-12 6M89 64q0-8-6-12") + g(H, GROUND),
 'bigtree': g(H, "M44 100q4-18 2-40h8q-2 22 4 40Z") + g(H, circ(50, 40, 18) + circ(32, 48, 12) + circ(68, 48, 12)) + g(S, "M46 64q-8 6-14 4M54 66q8 4 14 2"),
 'bamboo': "".join(g(H, f"M{x} 100V{t}h3V100Z") + g(S, "".join(f"M{x-.5} {y}h4" for y in range(t + 8, 100, 9))) for x, t in [(8, 20), (15, 34), (84, 16), (91, 30)]) + g(S, "M18 40q6-2 10 2M12 30q-6 0-8 4M87 34q-6-2-10 2M94 26q6 0 8 4"),
 'pagoda': g(H, "M40 100V76h20V100ZM33 76h34l-7-6H40ZM42 70V62h16v8ZM36 62h28l-6-5H42ZM44 57v-7h12v7ZM39 50h22l-11-9Z") + g(S, "M50 41v-5"),
 'dunes': g(H, "M0 80Q25 62 50 76T100 68V100H0Z") + g(S, "M0 90Q40 80 70 88T100 86") + g(S, circ(78, 26, 8) + "M78 12v-4M78 40v4M64 26h-4M92 26h4M68 16l-3-3M88 36l3 3M88 16l3-3M68 36l-3 3"),
 'pyramid': g(H, "M28 82L52 44L76 82Z") + g(H, "M66 82L78 64L90 82Z") + g(S, "M52 44L56 82M78 64l2 18"),
 'volcano': g(H, "M8 84L38 46H52L82 84Z") + g(S, "M42 42q-6-6 0-12t0-12M50 40q5-5 0-10t2-10") + g(F, "M42 46l2 10 3-6 2 14 3-18Z"),
 'waves': g(S, waves(70, 4)) + g(S, "M0 64H100"),
 'abyss': g(H, "M30 0L22 60H34L40 0ZM60 0L58 50H68L72 0Z") + g(Sw(1.4), "M10 100q-4-10 0-20t0-20M18 100q4-8 0-16t2-14M86 100q-4-10 0-20t0-22M92 100q4-8 0-14") + g(S, circ(50, 70, 2) + circ(54, 60, 1.4) + circ(48, 52, 1) + circ(72, 76, 1.6)),
 'cave': g(H, "M0 0H100V10L94 26L88 10L80 34L72 10L64 22L56 10L48 30L40 10L32 24L24 10L16 30L8 10L0 18Z") + g(H, "M0 100V92L8 80L14 92L22 74L30 92H60L66 78L72 92L84 84L90 92L100 86V100Z"),
 'graves': g(H, GROUND) + g(H, "M12 84V72a5 5 0 0 1 10 0V84ZM74 84V66a6 6 0 0 1 12 0V84Z") + g(H, "M40 84V70h-5v-3h5v-4h3v4h5v3h-5V84Z") + g(S, "M24 20a8 8 0 1 0 8-9a6 6 0 1 1-8 9Z"),
 'deadtrees': g(Sw(2), "M16 100V64l-8-10M16 72l9-10 4-8M16 64l2-12M84 100V60l7-8M84 68l-9-8-2-8M84 60l-2-12") + g(H, GROUND),
 'clouds': g(H, circ(20, 30, 7) + circ(28, 26, 8) + circ(36, 31, 6) + circ(70, 18, 6) + circ(78, 14, 7) + circ(86, 19, 5)),
 'island': g(H, "M28 66H72L64 76L54 92L48 80L38 76Z") + g(S, "M30 66q4-4 8 0q4-4 8 0q4-4 8 0q4-4 8 0q4-4 8 0"),
 'gears': g(H, gear(20, 26, 12, 10)) + g(H, gear(82, 70, 14, 12)) + g(S, circ(50, 50, 30) + "M50 50V28M50 50l14 8"),
 'pillars': g(H, "M6 100V30h10V100ZM84 100V30h10V100Z") + g(H, "M3 30h16v-4H3ZM81 30h16v-4H81Z") + g(S, "M0 22L50 4L100 22M9 34v62M13 34v62M87 34v62M91 34v62"),
 'dice': g(H, "M12 70l12-6 10 12-12 6ZM70 74l10-12 12 6-10 12Z") + g(F, circ(22, 72, 1.2) + circ(80, 70, 1.2) + circ(86, 74, 1.2)) + g(S, "M8 20l6 10 6-10-6-6ZM82 18c-2-5 6-5 4 0-2 5-4 6-4 6s-2-1-4-6c-2-5 6-5 4 0"),
 'coins': g(H, "".join(circ(x, y, 5) for x, y in [(14, 86), (14, 82), (14, 78), (86, 86), (86, 82), (80, 88)])) + g(S, "M30 10l-4 10 8-2ZM70 12l4 8-8 0Z"),
 'eggs': g(H, "M14 88c-6 0-8-8-6-14s6-10 6-10 6 4 6 10-0 14-6 14ZM86 90c-7 0-9-9-7-16s7-12 7-12 7 5 7 12-0 16-7 16Z") + g(S, "M8 78l3-3 3 3 3-3 3 3M79 78l3-3 3 3 3-3 3 3"),
 'maze': g(Sw(2), "M4 96V60H40M12 96V68H32V60M20 96V76H60V60M48 96V84H96M56 76H80V60M88 96V68") + g(S, "M60 60H96"),
 'acacia': g(Sw(2), "M20 100V72l-6-8M20 76l8-10M80 100V70l6-8M80 74l-8-10") + g(H, "M4 64q16-8 32 0ZM62 62q18-8 34 0Z") + g(H, GROUND),
 'pumpkins': g(H, "M8 90a9 7 0 0 1 18 0ZM70 90a12 9 0 0 1 24 0Z") + g(S, "M17 83v-4M82 81v-5M14 90v-6M20 90v-6M76 90v-8M88 90v-8") + g(S, "M50 18a8 8 0 1 0 6-8"),
 'torii': g(H, "M14 44h72v4H14ZM20 54h60v3H20Z") + g(H, "M26 48v40h4V48ZM70 48v40h4V48Z") + g(H, GROUND),
 'stars': g(F, "".join(star(x, y, r) for x, y, r in [(14, 18, 3), (30, 34, 1.6), (78, 14, 2.6), (88, 40, 1.6), (60, 26, 1.4), (20, 60, 1.4), (82, 72, 2)])) + g(S, "M14 18L30 34L60 26L78 14M78 14L88 40"),
 'swirl': g(S, "M50 50m-2 0a2 2 0 1 1 4 0a5 5 0 1 1-9 0a8 8 0 1 1 15 0a12 12 0 1 1-22 0a16 16 0 1 1 29 0"),
 'reeds': g(S, waves(80, 3, 2, 6)) + g(Sw(1.2), "M10 88V58M14 88V64M86 88V56M90 88V62M18 88q2-16 8-20") + g(F, "M9 58h2v8H9ZM85 56h2v8h-2Z"),
 'ship': g(H, "M28 78h44l-6 8H34Z") + g(S, "M50 78V40M40 78V50") + g(H, "M50 42l14 12H50ZM40 52l-10 10H40Z") + g(F, "M50 40l6 2-6 2Z") + g(S, waves(88, 2, 2)),
 'tent': g(H, "M20 86L50 46L80 86Z") + g(S, "M50 46L40 86M50 46L60 86M50 46L30 86M50 46L70 86M50 46V38") + g(F, "M50 38l7 2-7 2Z"),
 'blobs': g(H, "M6 88a9 10 0 0 1 18 0ZM72 88a12 13 0 0 1 24 0ZM56 88a5 6 0 0 1 10 0Z") + g(F, circ(12, 82, 1) + circ(18, 82, 1) + circ(80, 78, 1.3) + circ(88, 78, 1.3)),
 'ruins': g(H, "M10 100V56h8V100ZM10 56l3-5 5 4ZM78 100V44h9V100ZM78 44l4-6 5 5Z") + g(S, "M30 100V70a20 20 0 0 1 40 0V100") + g(H, GROUND),
 'carrots': g(H, "M12 92l-4-22 8 0ZM84 92l-4-26 8 0ZM70 94l-3-14 6 0Z") + g(S, "M12 70l-3-6M12 70l3-6M84 66l-3-7M84 66l3-7M70 80l-2-4M70 80l2-4") + g(H, GROUND),
 'curtain': g(H, "M0 0H100V6Q80 16 70 6Q60 18 50 6Q40 18 30 6Q20 16 0 6Z") + g(H, "M0 0V96Q8 60 12 6ZM100 0V96Q92 60 88 6Z") + g(S, "M38 96h24M42 96V88h16V96"),
 'flames': g(H, "M14 100q-10-16 0-34q2 10 6 12q2-10-2-20q14 12 8 42ZM86 100q10-16 0-34q-2 10-6 12q-2-10 2-20q-14 12-8 42ZM48 100q-6-8 2-18q0 6 4 6q2-6 0-12q8 10 2 24Z"),
 'rocks': g(H, "M8 92l4-20 6-6 6 8 2 18ZM76 92l2-24 8-10 6 14v20ZM60 94l2-10 6-4 4 6v8Z") + g(S, "M14 72l2 20M84 58l0 34"),
 'wind': g(S, "M6 30h40a6 6 0 1 0-6-6M10 44h56a8 8 0 1 1-8 8M20 62h30a5 5 0 1 0-5-5M56 20h34M60 76h32a6 6 0 1 1-6 6"),
 'empty': '',
 'runes': g(S, circ(50, 50, 40) + circ(50, 50, 34)) + g(S, "M50 10v6M50 84v6M10 50h6M84 50h6M22 22l4 4M78 78l-4-4M78 22l-4 4M22 78l4-4"),
}

# Zone -> (ciel, sol, décor lointain, décor proche)
Z = {
 'amakna': ('#cfe6f2', '#7fae4e', 'hills', 'windmill'),
 'astrub': ('#dfe6ee', '#b58f5c', 'hills', 'citytowers'),
 'plaines-de-cania': ('#efe1c0', '#a8946a', 'lowpeaks', 'stones'),
 'ile-de-frigost': ('#e6f2fb', '#8fb8d6', 'snowpeaks', 'pines'),
 'ile-d-otomai': ('#c9ecd0', '#2f7d55', 'bigtree', 'palms'),
 'landes-de-sidimote': ('#cdbfac', '#5b4636', 'lowpeaks', 'deadtrees'),
 'montagne-des-koalaks': ('#dcead2', '#7b8f52', 'peaks', 'trees'),
 'ile-de-pandala': ('#f2e3cf', '#7aa05a', 'pagoda', 'bamboo'),
 'archipel-de-vulkania': ('#f6c79a', '#7a3a22', 'volcano', 'palms'),
 'ile-de-moon': ('#fbe3b4', '#3e9a8f', 'waves', 'palms'),
 'foret-des-abraknydes': ('#b8c9a4', '#2f4a2c', 'pines', 'trees'),
 'ile-des-wabbits': ('#e7f2d0', '#c77a2e', 'waves', 'carrots'),
 'ile-de-nowel': ('#f3f6fb', '#b84a4a', 'snowpeaks', 'pines'),
 'incarnam': ('#f7f2ff', '#b9a8e0', 'clouds', 'island'),
 'saharach': ('#fbe2b0', '#d39a4e', 'dunes', 'pyramid'),
 'dimensions-des-cavaliers': ('#e7b2a0', '#5a1f1a', 'ruins', 'spires'),
 'ile-de-grobe': ('#dcd7e8', '#4f4a66', 'torii', 'graves'),
 'sanctuaire-des-jardins-eternels': ('#f2eacb', '#8fae6a', 'pillars', 'trees'),
 'baie-de-sufokia': ('#cdeaf5', '#2f86a8', 'citytowers', 'waves'),
 'profondeurs-de-sufokia': ('#4f93b4', '#0b2a44', 'abyss', None),
 'gouffre-du-gigalodon': ('#3d7590', '#081e33', 'abyss', 'cave'),
 'ecaflipus': ('#f5dfb8', '#a8452e', 'runes', 'dice'),
 'bonta': ('#eef4fb', '#5d86c2', 'clouds', 'citytowers'),
 'brakmar': ('#e8b3a0', '#4a1712', 'spires', 'flames'),
 'enutrosor': ('#f6e2a0', '#9a6e1c', 'cave', 'coins'),
 'srambad': ('#c0b6cf', '#2e2540', 'spires', 'graves'),
 'xelorium': ('#d7e3e6', '#4a6a78', 'gears', None),
 'ile-de-pwak': ('#f3dcc2', '#6b3e22', 'hills', 'eggs'),
 'archipel-de-valonia': ('#d8e2c8', '#4f6b4a', 'peaks', 'citytowers'),
 'ile-du-minotoror': ('#e9d6b4', '#8a5a34', 'lowpeaks', 'maze'),
 'osavora': ('#f6dfa8', '#b0832f', 'lowpeaks', 'acacia'),
 'foret-malefique': ('#e8c6a0', '#4a2b3a', 'deadtrees', 'pumpkins'),
 'wukin-et-wukang': ('#f3eee2', '#3a3a3a', 'peaks', 'bamboo'),
 'ile-de-sakai': ('#eaf1f6', '#8aa3b8', 'snowpeaks', 'cave'),
 'dimension-obscure': ('#a197b8', '#1e1830', 'pyramid', 'stars'),
 'nimotopia': ('#e9e2fb', '#8a7ac8', 'clouds', 'stars'),
 'archipel-des-ecailles': ('#cfe2c8', '#3e6a52', 'waves', 'reeds'),
 'atoll-des-possedes': ('#cdd6e0', '#2c3e50', 'waves', 'ship'),
 'cauchemar-des-ravageurs': ('#c9a0c8', '#3a1440', 'spires', 'flames'),
 'gelaxieme-dimension': ('#f0d6f0', '#6a8fd0', 'stars', 'blobs'),
 'ilots-de-la-mer-d-asse': ('#f2dcc4', '#7a3a3a', 'waves', 'tent'),
 'labyrinthe-du-dragon-cochon': ('#e8cfb0', '#6b3a1e', 'cave', 'maze'),
 'foire-du-trool': ('#f6e0c6', '#8a3a6a', 'hills', 'tent'),
 # Autres séries
 'atelier': ('#ece0c6', '#8a6a40', 'curtain', None),
 'temple': ('#efe2c0', '#a07a40', 'pillars', 'runes'),
 'krosmoz': ('#3a2a6a', '#120c2a', 'stars', 'swirl'),
 'el-feu': ('#f8c08a', '#c2421e', 'flames', None),
 'el-eau': ('#bfe2f6', '#2d72b8', 'waves', None),
 'el-terre': ('#dcc49a', '#7a5a2e', 'rocks', None),
 'el-air': ('#e2f2d6', '#5f9f6a', 'wind', None),
 'el-neutre': ('#e2dccf', '#6f685e', 'runes', None),
}

def uri(s):
    return 'url("data:image/svg+xml,' + quote(s, safe="=:/ '") + '")'

out = ["/* =====================================================================",
       "   Décors gravés : chaque carte porte le paysage de sa zone d'origine",
       "   (palette ciel/sol + gravure en taille-douce dans l'encre de la rareté).",
       "   Généré par scripts/scenes.py",
       "   ===================================================================== */"]
for k, body in M.items():
    out.append(f".bc-scene{{--m-{k}:{uri(svg(body))}}}" if False else "")
out = [l for l in out if l]
# Variables de motifs déclarées une fois sur :root pour éviter de les répéter
out.append(":root{" + ";".join(f"--m-{k}:{uri(svg(body))}" for k, body in M.items()) + "}")
for z, (sky, ground, far, near) in Z.items():
    decl = f"--sky:{sky};--ground:{ground};--far:var(--m-{far})"
    decl += f";--near:var(--m-{near or 'empty'})"
    out.append(f".bc-scene.z-{z}{{{decl}}}")
open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'css', 'scenes.css'), 'w').write("\n".join(out) + "\n")
print(len("\n".join(out)), 'octets')
print(sorted(Z))
