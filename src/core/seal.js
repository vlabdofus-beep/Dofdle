// Garde-fou contre la modification à la main des sauvegardes (coffres, collection, séries).
// Ce n'est pas une sécurité : le code du site est public, un joueur déterminé peut le
// contourner. Cela empêche seulement de changer une valeur dans le navigateur en deux clics :
// une sauvegarde modifiée ne correspond plus à sa signature et n'est pas prise en compte.
const SALT = 'dofusle:krosmoz:7f3a91c2';

/** Empreinte rapide (cyrb53) d'un texte, en base 36. */
export function sign(text) {
  const str = SALT + text;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Lit une valeur signée. Renvoie { raw, state } : state vaut 'ok', 'legacy' (pas encore de
 * signature : sauvegarde d'avant le garde-fou) ou 'tampered' (modifiée à la main).
 */
export function readSigned(key) {
  let raw = null, sig = null;
  try { raw = localStorage.getItem(key); sig = localStorage.getItem(`${key}:sig`); } catch { /* indisponible */ }
  if (raw == null) return { raw: null, state: 'ok' };
  if (sig == null) return { raw, state: 'legacy' };
  return { raw, state: sig === sign(raw) ? 'ok' : 'tampered' };
}

export function writeSigned(key, raw) {
  try { localStorage.setItem(key, raw); localStorage.setItem(`${key}:sig`, sign(raw)); } catch { /* plein ou bloqué */ }
}
