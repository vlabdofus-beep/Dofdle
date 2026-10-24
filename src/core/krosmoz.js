// Calendrier du Krosmoz : mêmes jours que le calendrier réel, noms de mois de Dofus.
export const KROSMOZ_MONTHS = ['Javian', 'Flovor', 'Martalo', 'Aperirel', 'Maisial', 'Juinssidor', 'Joullier', 'Fraouctor', 'Septange', 'Octolliard', 'Novamaire', 'Descendre'];
export const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/** « Samedi 24 Octolliard » pour une date AAAA-MM-JJ. */
export function krosmozDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${KROSMOZ_MONTHS[m - 1]}`;
}
