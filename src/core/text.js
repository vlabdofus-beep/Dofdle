// Utilitaires texte : normalisation des noms français (accents, apostrophes…)

/** "Larvonika l'Instrument" -> "larvonika l instrument" ; "Épée" -> "epee" */
export function normalize(str = '') {
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[’'`´\-_.,:;!?()[\]{}"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nom localisé (fr par défaut, repli en). */
export const tr = (obj, lang = 'fr') => (obj && (obj[lang] || obj.fr || obj.en)) || '';

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Supprime les balises/markup du jeu dans les descriptions ({{...}}, <b>, etc.) */
export function cleanGameText(s = '') {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formate un effet à partir du gabarit DofusDB : "#1{{~1~2 à }}#2 Force" */
export function formatEffect(template, from, to) {
  if (!template) return '';
  let s = template.replace(/#1\{\{~1~2 ([^}]*)\}\}#2/g, (_, sep) => (to && to !== from ? `${from} ${sep}${to}` : `${from}`));
  s = s.replace(/#1/g, from ?? '').replace(/#2/g, to || '').replace(/#3/g, '');
  return cleanGameText(s).replace(/--/g, '-').replace(/\s+%/g, '%');
}
