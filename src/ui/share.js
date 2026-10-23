import { toast } from './dom.js';

/** Partage : presse-papiers (ou feuille de partage native sur mobile). */
export async function shareResult(text, okMessage = 'Copié !') {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile && navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* annulé : on copie */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast(okMessage); } catch { toast('Copie impossible'); }
    ta.remove();
  }
}
