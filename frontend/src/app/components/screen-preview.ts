import { currentLang, translate } from '../core/i18n';

/**
 * Écran du moniteur 3D : la page d'accueil de ByteBazaar ouverte dans un navigateur (thème sombre),
 * dessinée sur un canvas. Mise en page d'après l'accueil réel en 1600 × 900, plus la barre du
 * navigateur ; centrée et mise à l'échelle selon le format de la dalle (16:9, 16:10, 21:9, 32:9).
 */
const PAGE_W = 1600;
const BROWSER_H = 44;
const PAGE_H = 900 + BROWSER_H;

const C = {
  bg: '#070b16',
  surface: '#0f1526',
  surface2: '#151d33',
  border: '#212b47',
  text: '#e8ecf6',
  text2: '#c2cadc',
  muted: '#8d99b4',
  accent: '#f59e0b',
  pink: '#f472b6',
  cyan: '#22d3ee',
};
const DISPLAY = '"Bricolage Grotesque", "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
const BODY = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function pill(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string | CanvasGradient,
  align: CanvasTextAlign = 'left',
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

/** Découpe en lignes ; la dernière ligne autorisée se termine par « … » si le texte déborde */
function wrap(ctx: Ctx, value: string, maxWidth: number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/** Logo « BB » en pixels (même grille que LogoMark) */
function logo(ctx: Ctx, x: number, y: number, size: number) {
  const tile = ctx.createLinearGradient(x, y, x + size, y + size);
  tile.addColorStop(0, '#1a2440');
  tile.addColorStop(1, '#0b1222');
  roundRect(ctx, x, y, size, size, size * 0.23);
  ctx.fillStyle = tile;
  ctx.fill();
  const rows = ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'];
  const cell = (size / 64) * 4.65;
  const dot = (size / 64) * 3.9;
  const x0 = x + (size - 11 * cell + (cell - dot)) / 2;
  const y0 = y + (size - 7 * cell + (cell - dot)) / 2;
  const square = (col: number, row: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0 + col * cell, y0 + row * cell, dot, dot);
  };
  for (const offset of [0, 6])
    rows.forEach((r, row) =>
      [...r].forEach((c, col) => {
        if (c !== 'X') return;
        square(offset + col, row, offset + col === 9 && row === 0 ? '#f7a215' : '#f3f6fc');
      }),
    );
  square(10, 6, C.cyan);
}

function browserBar(ctx: Ctx, width: number) {
  ctx.fillStyle = '#1c2030';
  ctx.fillRect(0, 0, width, BROWSER_H);
  // Onglet actif
  ctx.fillStyle = '#2a2f42';
  roundRect(ctx, 12, 7, 250, BROWSER_H - 7, 10);
  ctx.fill();
  logo(ctx, 26, 15, 16);
  text(ctx, 'ByteBazaar', 52, 24, `600 14px ${BODY}`, C.text);
  text(ctx, '×', 244, 24, `400 16px ${BODY}`, C.muted, 'center');
  // Barre d'adresse
  pill(ctx, 290, 9, Math.min(760, width - 340), 27, '#11141f');
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.6;
  roundRect(ctx, 306, 20, 9, 8, 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(310.5, 20, 3, Math.PI, 0);
  ctx.stroke();
  text(ctx, 'bytebazaar.tn', 326, 23, `500 14px ${BODY}`, C.text2);
}

function header(ctx: Ctx) {
  logo(ctx, 200, 19, 34);
  ctx.font = `700 22px ${DISPLAY}`;
  const byte = ctx.measureText('Byte').width;
  text(ctx, 'Byte', 245, 37, ctx.font, C.text);
  text(ctx, 'Bazaar', 245 + byte, 37, ctx.font, C.accent);

  // Menu en pastille ajustée à ses liens (avant les boutons d'action, qui commencent à x = 900)
  const items = [
    translate('Accueil'),
    translate('Catalogue'),
    translate('Configurateur'),
    translate('À propos'),
    translate('Contact'),
  ];
  ctx.font = `600 14.5px ${BODY}`;
  const widths = items.map((item) => ctx.measureText(item).width + 24);
  const navW = Math.min(widths.reduce((sum, w) => sum + w, 0) + 12, 880 - 376);
  const fit = Math.min(1, (navW - 12) / widths.reduce((sum, w) => sum + w, 0));
  pill(ctx, 376, 14, navW, 46, C.surface, C.border);
  let x = 382;
  items.forEach((item, i) => {
    const w = widths[i] * fit;
    // « Accueil » actif
    if (i === 0) pill(ctx, x, 20, w, 34, 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.55)');
    text(ctx, item, x + w / 2, 37, ctx.font, i === 0 ? C.accent : C.text2, 'center');
    x += w;
  });

  // Actions : recherche, langue, thème, panier, connexion, inscription
  const round = (cx: number) => {
    ctx.beginPath();
    ctx.arc(cx, 37, 21, 0, Math.PI * 2);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  round(922);
  ctx.strokeStyle = C.text2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(920, 35, 6, 0, Math.PI * 2);
  ctx.moveTo(924.5, 39.5);
  ctx.lineTo(929, 44);
  ctx.stroke();
  pill(ctx, 956, 16, 76, 42, C.surface, C.border);
  text(ctx, currentLang() === 'en' ? 'EN' : 'FR', 1000, 37, `700 14px ${BODY}`, C.text, 'center');
  pill(ctx, 1040, 16, 72, 42, C.surface, C.border);
  ctx.beginPath();
  ctx.arc(1092, 37, 15, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  round(1136);
  ctx.strokeStyle = C.text2;
  ctx.strokeRect(1128, 32, 15, 10);
  pill(ctx, 1168, 16, 112, 42, C.surface, C.border);
  text(ctx, translate('Connexion'), 1224, 37, `700 14px ${BODY}`, C.text, 'center');
  pill(ctx, 1290, 16, 110, 42, C.accent);
  text(ctx, translate('Inscription'), 1345, 37, `700 14px ${BODY}`, '#1a1205', 'center');
}

function hero(ctx: Ctx) {
  const x = 200;
  const y = 97;
  const w = 1200;
  const h = 618;
  ctx.save();
  roundRect(ctx, x, y, w, h, 40);
  const bg = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  bg.addColorStop(0, '#1a2440');
  bg.addColorStop(0.6, '#161a33');
  bg.addColorStop(1, '#2a1f3d');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  // Halo orange (haut droit) et quadrillage discret
  const glow = ctx.createRadialGradient(x + w - 110, y + 70, 20, x + w - 110, y + 70, 240);
  glow.addColorStop(0, 'rgba(245,158,11,0.75)');
  glow.addColorStop(0.55, 'rgba(245,158,11,0.45)');
  glow.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let gx = x; gx < x + w; gx += 44) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let gy = y; gy < y + h; gy += 44) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, x, y, w, h, 40);
  ctx.stroke();

  // Pastille d'introduction
  const eyebrow = translate('Composants PC · Tunisie');
  ctx.font = `600 14px ${BODY}`;
  pill(
    ctx,
    248,
    161,
    ctx.measureText(eyebrow).width + 54,
    32,
    'rgba(255,255,255,0.08)',
    'rgba(255,255,255,0.12)',
  );
  ctx.beginPath();
  ctx.arc(268, 177, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.cyan;
  ctx.fill();
  text(ctx, eyebrow, 282, 177, ctx.font, C.text);

  // Titre : « composants PC » en dégradé rose → blanc, comme sur le site
  ctx.font = `800 56px ${DISPLAY}`;
  const words = [
    ...translate('Le bazar des')
      .split(' ')
      .map((w) => ({ w, shine: false })),
    ...translate('composants PC')
      .split(' ')
      .map((w) => ({ w, shine: true })),
    ...translate('en Tunisie')
      .split(' ')
      .map((w) => ({ w, shine: false })),
  ];
  const space = ctx.measureText(' ').width;
  let cx = 248;
  let line = 0;
  for (const { w, shine } of words) {
    const width = ctx.measureText(w).width;
    if (cx + width > 248 + 540 && cx > 248) {
      cx = 248;
      line++;
    }
    const cy = 238 + line * 60;
    if (shine) {
      const g = ctx.createLinearGradient(cx, 0, cx + 260, 0);
      g.addColorStop(0, '#f9a8d4');
      g.addColorStop(0.35, '#fde7f3');
      g.addColorStop(1, C.text);
      text(ctx, w, cx, cy, ctx.font, g);
    } else text(ctx, w, cx, cy, ctx.font, C.text);
    cx += width + space;
  }
  const leadY = 238 + line * 60 + 72;

  ctx.font = `400 18px ${BODY}`;
  const lead = wrap(
    ctx,
    translate(
      'Un très large choix multi-marques, des prix clairs en TND et un configurateur 3D qui garantit des assemblages compatibles.',
    ),
    560,
    3,
  );
  lead.forEach((l, i) => text(ctx, l, 248, leadY + i * 30, ctx.font, C.text2));

  // Boutons, sous la dernière ligne du texte
  const by = leadY + (lead.length - 1) * 30 + 68;
  ctx.font = `700 15px ${BODY}`;
  const primary = `${translate('Voir le catalogue')}  →`;
  const pw = ctx.measureText(primary).width + 52;
  pill(ctx, 248, by - 23, pw, 46, C.accent);
  text(ctx, primary, 248 + pw / 2, by, ctx.font, '#1a1205', 'center');
  const secondary = translate('Composer mon PC');
  const sw = ctx.measureText(secondary).width + 70;
  pill(ctx, 260 + pw, by - 23, sw, 46, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.22)');
  text(ctx, secondary, 260 + pw + 46, by, ctx.font, C.text);
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(260 + pw + 22, by + 6);
  ctx.lineTo(260 + pw + 32, by - 4);
  ctx.stroke();

  // Chiffres clés
  const sy = Math.max(by + 64, 575);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(248, sy, 578, 1);
  (
    [
      ['3 891', translate('Produits')],
      ['14', translate('Catégories')],
      ['171', translate('Marques')],
    ] as const
  ).forEach(([n, label], i) => {
    text(ctx, n, 248 + i * 112, sy + 40, `800 28px ${DISPLAY}`, C.text);
    text(ctx, label, 248 + i * 112, sy + 68, `600 13px ${BODY}`, C.text2);
  });
}

interface Product {
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  category: () => string;
  name: string;
  price: string;
  draw: (ctx: Ctx, w: number, h: number) => void;
}

const PRODUCTS: Product[] = [
  {
    cx: 975,
    cy: 395,
    w: 232,
    h: 252,
    angle: -7,
    category: () => translate('Mémoire RAM'),
    name: 'Corsair Vengeance LPX 16 GB (2 x 8 GB) DDR4-3600',
    price: '676 TND',
    draw: (ctx, w, h) => {
      // Barrette : dissipateur noir, PCB vert, contacts dorés
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.18);
      ctx.fillStyle = '#1d6b3a';
      ctx.fillRect(-w * 0.4, -h * 0.02, w * 0.8, h * 0.2);
      ctx.fillStyle = '#c9a227';
      for (let i = 0; i < 26; i++)
        ctx.fillRect(-w * 0.38 + i * w * 0.029, h * 0.15, w * 0.018, h * 0.03);
      ctx.fillStyle = '#121418';
      ctx.beginPath();
      ctx.moveTo(-w * 0.42, h * 0.04);
      ctx.lineTo(-w * 0.42, -h * 0.16);
      ctx.lineTo(-w * 0.2, -h * 0.2);
      ctx.lineTo(w * 0.42, -h * 0.2);
      ctx.lineTo(w * 0.42, h * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d6b84a';
      ctx.font = `800 ${h * 0.07}px ${BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VENGEANCE', w * 0.08, -h * 0.08);
      ctx.restore();
    },
  },
  {
    cx: 1130,
    cy: 330,
    w: 212,
    h: 272,
    angle: 3,
    category: () => translate('Refroidissement CPU'),
    name: 'Cooler Master MASTERLIQUID ML240L RGB V2',
    price: '300 TND',
    draw: (ctx, w, h) => {
      // Radiateur 240 mm et deux ventilateurs à anneau violet
      ctx.fillStyle = '#16181d';
      roundRect(ctx, w * 0.3, h * 0.06, w * 0.4, h * 0.88, 6);
      ctx.fill();
      for (const fy of [0.29, 0.71]) {
        const cy = h * fy;
        const ring = ctx.createRadialGradient(w / 2, cy, w * 0.04, w / 2, cy, w * 0.17);
        ring.addColorStop(0, '#3b2a6b');
        ring.addColorStop(0.7, '#a78bfa');
        ring.addColorStop(1, '#5b3fd0');
        ctx.beginPath();
        ctx.arc(w / 2, cy, w * 0.17, 0, Math.PI * 2);
        ctx.fillStyle = ring;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w / 2, cy, w * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = '#20232b';
        ctx.fill();
      }
    },
  },
  {
    cx: 1222,
    cy: 500,
    w: 216,
    h: 240,
    angle: 7,
    category: () => translate('Écrans'),
    name: 'Dell S3222DGM 31.5" QHD 165 Hz VA',
    price: '982 TND',
    draw: (ctx, w, h) => {
      // Écran incurvé : fond d'écran coloré, pied
      ctx.fillStyle = '#111317';
      ctx.fillRect(w * 0.42, h * 0.62, w * 0.16, h * 0.22);
      ctx.fillRect(w * 0.3, h * 0.82, w * 0.4, h * 0.05);
      ctx.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.52);
      const wall = ctx.createLinearGradient(w * 0.1, h * 0.14, w * 0.9, h * 0.6);
      wall.addColorStop(0, '#3b1d6e');
      wall.addColorStop(0.5, '#c2185b');
      wall.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = wall;
      ctx.fillRect(w * 0.1, h * 0.14, w * 0.8, h * 0.48);
    },
  },
];

function productCard(ctx: Ctx, p: Product) {
  ctx.save();
  ctx.translate(p.cx, p.cy);
  ctx.rotate((p.angle * Math.PI) / 180);
  ctx.translate(-p.w / 2, -p.h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, 0, 0, p.w, p.h, 18);
  ctx.fillStyle = C.surface;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Photo sur fond blanc
  const imgH = p.h * 0.5;
  ctx.save();
  roundRect(ctx, 9, 9, p.w - 18, imgH, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();
  ctx.translate(9, 9);
  p.draw(ctx, p.w - 18, imgH);
  ctx.restore();
  const tx = 18;
  let ty = imgH + 32;
  text(ctx, p.category().toUpperCase(), tx, ty, `700 10.5px ${BODY}`, C.muted);
  ctx.font = `700 13.5px ${BODY}`;
  for (const l of wrap(ctx, p.name, p.w - 36, 2)) {
    ty += 19;
    text(ctx, l, tx, ty, ctx.font, C.text);
  }
  text(ctx, p.price, tx, ty + 28, `800 16px ${DISPLAY}`, C.accent);
  ctx.restore();
}

function brands(ctx: Ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(200, 745, 1200, 1);
  ctx.fillRect(200, 800, 1200, 1);
  ctx.font = `700 20px ${DISPLAY}`;
  let x = 262;
  for (const brand of [
    'Gigabyte',
    'Corsair',
    'Kingston',
    'Samsung',
    'Western Digital',
    'Crucial',
    'G.Skill',
    'NZXT',
    'Lian Li',
  ]) {
    text(ctx, brand, x, 772, ctx.font, 'rgba(141,153,180,0.75)');
    x += ctx.measureText(brand).width + 46;
  }
  ctx.beginPath();
  ctx.arc(204, 872, 4, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  text(
    ctx,
    translate('Trouvez votre composant').toUpperCase(),
    214,
    872,
    `700 11.5px ${BODY}`,
    C.accent,
  );
}

export function drawSitePreview(ctx: Ctx) {
  const { width: W, height: H } = ctx.canvas;
  const scale = Math.min(W / PAGE_W, H / PAGE_H);
  const viewW = W / scale; // largeur visible en unités de la maquette (écrans ultra-larges : plus)
  ctx.save();
  ctx.scale(scale, scale);
  // Fond de page avec halos colorés
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, viewW, H / scale);
  const halo = ctx.createRadialGradient(viewW * 0.3, 500, 50, viewW * 0.3, 500, 900);
  halo.addColorStop(0, 'rgba(245,158,11,0.10)');
  halo.addColorStop(1, 'rgba(245,158,11,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, viewW, H / scale);
  browserBar(ctx, viewW);
  // Bandeau d'en-tête sur toute la largeur, contenu centré comme sur le site
  ctx.fillStyle = 'rgba(7,11,22,0.9)';
  ctx.fillRect(0, BROWSER_H, viewW, 73);
  ctx.fillStyle = C.border;
  ctx.fillRect(0, BROWSER_H + 72, viewW, 1);
  ctx.translate((viewW - PAGE_W) / 2, BROWSER_H);
  header(ctx);
  hero(ctx);
  for (const p of PRODUCTS) productCard(ctx, p);
  brands(ctx);
  ctx.restore();
}
