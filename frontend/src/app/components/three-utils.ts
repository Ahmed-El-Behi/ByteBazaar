// Utilitaires partagés par les modèles 3D du configurateur (PC et bureau).
import * as THREE from 'three';
import type { ConfiguratorPart } from '../core/configurator-api';

/** Produit blanc ? (couleur indiquée dans le nom : « White » / « Blanc ») */
export const isWhite = (part: ConfiguratorPart | null) => !!part && /\b(white|blanc)\b/i.test(part.name);

// Couleur principale annoncée dans le nom (« … (Bleu / Teal) », « White Edition »…)
const COLOR_WORDS: [RegExp, number][] = [
  [/\b(white|blanc)\b/i, 0xeef0f4],
  [/\b(pink|rose)\b/i, 0xf3a5c4],
  [/\b(blue|bleu)\b/i, 0x2f63d8],
  [/\b(red|rouge)\b/i, 0xc8283f],
  [/\b(green|vert)\b/i, 0x2c9a57],
  [/\b(purple|violet|lavender|lavande)\b/i, 0x8b6ad8],
  [/\b(yellow|jaune)\b/i, 0xe2b324],
  [/\b(gr[ae]y|gris|silver|argent)\b/i, 0x8c939f],
];

/** Couleur de coque d'un périphérique d'après son nom, sinon la couleur par défaut (noir). */
export function productColor(part: ConfiguratorPart | null, fallback = 0x1b1d23): number {
  if (!part) return fallback;
  // On ne regarde que la mention de couleur finale (entre parenthèses) ou « … Edition », pas les switchs
  const colorText = /\(([^()]*)\)\s*$/.exec(part.name)?.[1] ?? part.name.replace(/\(.*?\)/g, '');
  const first = colorText.split(/[/,]/)[0];
  for (const [pattern, color] of COLOR_WORDS) if (pattern.test(first)) return color;
  return fallback;
}

/** Produit avec éclairage RGB ? (indice dans le nom ou le rétroéclairage du clavier) */
export const isRgb = (part: ConfiguratorPart | null) =>
  !!part && (/\b(rgb|chroma|lightsync|spectrum|argb)\b/i.test(part.name) || /rgb/i.test(part.keyboard?.backlight ?? ''));

/** Générateur pseudo-aléatoire déterministe */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Texture dessinée sur un canvas 2D */
export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
