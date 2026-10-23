// Couleur dominante d'un monstre, calculée à partir de son image DofusDB.
// Même algorithme dans le navigateur (canvas) et dans Node (scripts/png.mjs),
// pour que le snapshot et le calcul à la volée donnent le même résultat.

export const COLORS = {
  rouge: { label: 'Rouge', hex: '#d23b32' },
  orange: { label: 'Orange', hex: '#ec8a2c' },
  jaune: { label: 'Jaune', hex: '#efcf3a' },
  beige: { label: 'Beige', hex: '#dcc7a0' },
  marron: { label: 'Marron', hex: '#7a4e2b' },
  vert: { label: 'Vert', hex: '#5aa83a' },
  bleu: { label: 'Bleu', hex: '#3d86d6' },
  violet: { label: 'Violet', hex: '#8a55c9' },
  rose: { label: 'Rose', hex: '#e27bb4' },
  gris: { label: 'Gris', hex: '#9a9a9a' },
  blanc: { label: 'Blanc', hex: '#f2f0ea' },
  noir: { label: 'Noir', hex: '#262321' },
};

/** Part minimale (sur les pixels opaques) pour qu'une couleur secondaire compte. */
const SECONDARY_SHARE = 0.15;

function nameOf(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  if (l < 0.13) return 'noir';
  if (l > 0.86 && s < 0.3) return 'blanc';
  if (s < 0.16) return 'gris';
  if ((h < 45 || h >= 345) && l < 0.38 && s < 0.75) return 'marron';
  if (h >= 20 && h < 65 && l >= 0.55 && s < 0.5) return 'beige';
  if (h < 18 || h >= 345) return 'rouge';
  if (h < 42) return 'orange';
  if (h < 70) return 'jaune';
  if (h < 165) return 'vert';
  if (h < 255) return 'bleu';
  if (h < 290) return 'violet';
  return 'rose';
}

/**
 * @param {Uint8Array|Uint8ClampedArray} rgba pixels RGBA non prémultipliés
 * @returns {string[]} [dominante, secondaire?]
 */
export function classifyPixels(rgba) {
  const counts = {};
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 200) continue; // fond transparent / bords lissés
    const c = nameOf(rgba[i], rgba[i + 1], rgba[i + 2]);
    counts[c] = (counts[c] || 0) + 1;
    total++;
  }
  if (!total) return [];
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const out = [sorted[0][0]];
  if (sorted[1] && sorted[1][1] / total >= SECONDARY_SHARE) out.push(sorted[1][0]);
  return out;
}

/** Comparaison : vert si même dominante, orange si une couleur en commun. */
export function compareColors(g = [], t = []) {
  if (!g.length || !t.length) return 'ko';
  if (g[0] === t[0]) return 'ok';
  return g.some((c) => t.includes(c)) ? 'partial' : 'ko';
}

// ---------- Navigateur : calcul à la volée + cache local ----------

const CACHE_KEY = 'dofusle:v1:colors';
let memo = null;
function cache() {
  if (memo) return memo;
  try { memo = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { memo = {}; }
  return memo;
}
function persist() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(memo)); } catch { /* plein / indisponible */ } }

export async function colorsFromImage(url) {
  const c = cache();
  if (c[url]) return c[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const colors = classifyPixels(ctx.getImageData(0, 0, bmp.width, bmp.height).data);
  c[url] = colors;
  persist();
  return colors;
}
