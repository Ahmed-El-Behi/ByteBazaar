import type { IconName } from '../components/icon';

/** Icône Lucide de chaque catégorie (d'après son slug) — accueil et catalogue. */
export function categoryIcon(slug: string): IconName {
  const s = slug.toLowerCase();
  if (/graphi|gpu/.test(s)) return 'gpu';
  if (/processeur|processor|cpu/.test(s)) return 'cpu';
  if (/cartes?-meres?|motherboard/.test(s)) return 'motherboard';
  if (/memoire|memory|ram/.test(s)) return 'memory';
  if (/stockage|storage|ssd|hdd/.test(s)) return 'storage';
  if (/refroidissement|cooling/.test(s)) return 'cooling';
  if (/alimentation|power/.test(s)) return 'power';
  if (/ecran|monitor/.test(s)) return 'monitor';
  if (/souris|mouse/.test(s)) return 'mouse';
  if (/clavier|keyboard/.test(s)) return 'keyboard';
  if (/casque|headset|headphone/.test(s)) return 'headset';
  if (/enceinte|speaker/.test(s)) return 'speaker';
  if (/webcam/.test(s)) return 'webcam';
  if (/peripherique|peripheral/.test(s)) return 'keyboard';
  return 'box';
}
