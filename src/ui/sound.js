// Sons du jeu, désactivés par défaut. Synthétisés dans le navigateur (aucun fichier,
// aucun son repris du jeu) : courts et doux, pour accompagner les actions du joueur.
import { getPref, setPref } from '../core/storage.js';

let ctx = null;
const audio = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};

export const soundOn = () => getPref('sound', 'off') === 'on';
export function setSound(on) {
  setPref('sound', on ? 'on' : 'off');
  if (on) play('reveal');
}

/** Une note : fréquence (Hz), départ et durée (s), timbre, volume. */
function note(a, freq, start, dur, type = 'sine', vol = 0.12) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

const SOUNDS = {
  // Proposition jouée : petit « toc » de bois
  guess: (a) => { note(a, 220, 0, 0.09, 'triangle', 0.1); note(a, 330, 0.01, 0.06, 'sine', 0.05); },
  // Au moins un critère juste : deux notes montantes
  good: (a) => { note(a, 523, 0, 0.14, 'sine', 0.09); note(a, 784, 0.07, 0.18, 'sine', 0.08); },
  // Indice révélé : petite cloche
  reveal: (a) => { note(a, 880, 0, 0.35, 'sine', 0.07); note(a, 1320, 0.02, 0.25, 'sine', 0.03); },
  // Dofus récolté : arpège doré
  harvest: (a) => [523, 659, 784, 1047].forEach((f, i) => note(a, f, i * 0.09, 0.45, 'triangle', 0.09)),
  // Journée complète : arpège plus ample
  day: (a) => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => note(a, f, i * 0.1, 0.7, 'triangle', 0.08)),
};

export function play(name) {
  if (!soundOn() || !SOUNDS[name]) return;
  try { const a = audio(); if (a) SOUNDS[name](a); } catch { /* audio indisponible */ }
}
