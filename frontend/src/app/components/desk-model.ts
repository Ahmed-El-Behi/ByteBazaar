// Poste de travail 3D (bureau, écran, clavier, souris, casque), même repère que pc-model.ts.
// Le PC est posé à droite du bureau (x ≈ 0), le poste occupe la gauche.

import * as THREE from 'three';
import type { ConfiguratorPart } from '../core/configurator-api';
import type { Builder } from './pc-model';
import { canvasTexture, isRgb, isWhite, productColor, seeded } from './three-utils';

/** Dessus du bureau (le PC a ses pieds juste au-dessus) */
export const DESK_Y = -1.9;
/** Point visé par la caméra en vue d'ensemble */
export const DESK_TARGET = new THREE.Vector3(-70, 16, 0);

const MAT_Y = DESK_Y + 0.3; // tapis de bureau
const MONITOR = { x: -82, z: -18 };
const KEYBOARD = { x: -82, z: 20 };
const MOUSE = { x: -30, z: 22 };
const HEADSET = { x: -158, z: -12, hookY: DESK_Y + 28 };

// Bureau (décor fixe)

export function buildDesk(b: Builder) {
  // Plateau en noyer : veinage dessiné sur un canvas
  const wood = b.track(
    canvasTexture(1024, 256, (ctx) => {
      const rand = seeded(42);
      ctx.fillStyle = '#4a3324';
      ctx.fillRect(0, 0, 1024, 256);
      for (let i = 0; i < 140; i++) {
        const y = rand() * 256;
        ctx.strokeStyle = `rgba(${rand() > 0.5 ? '30, 18, 10' : '120, 84, 58'}, ${0.12 + rand() * 0.18})`;
        ctx.lineWidth = 1 + rand() * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 1024; x += 64)
          ctx.lineTo(x, y + Math.sin(x / 90 + i) * (2 + rand() * 6));
        ctx.stroke();
      }
    }),
  );
  b.rounded(
    232,
    4,
    86,
    0.8,
    b.mat(0xffffff, { map: wood, roughness: 0.62, metalness: 0.05 }),
    -70,
    DESK_Y - 2,
    0,
  );
  // Pieds-panneaux
  const leg = b.mat(0x1b1d22, { metalness: 0.6, roughness: 0.4 });
  for (const x of [-182, 42]) b.box(4, 70, 74, leg, x, DESK_Y - 39, 0);

  // Tapis de bureau avec liseré RGB
  b.rounded(
    140,
    0.3,
    32,
    1.2,
    b.mat(0x14161b, { roughness: 0.95, metalness: 0 }),
    -76,
    DESK_Y + 0.15,
    21,
  );
  b.strip(140, 0.2, 0.25, -76, DESK_Y + 0.32, 37);
  b.strip(140, 0.2, 0.25, -76, DESK_Y + 0.32, 5);

  // Support de casque
  const metal = b.mat(0x22252c, { metalness: 0.8, roughness: 0.3 });
  b.cylinder(6.5, 0.8, metal, HEADSET.x, DESK_Y + 0.4, HEADSET.z, 'y', 40);
  b.cylinder(
    0.75,
    HEADSET.hookY - DESK_Y,
    metal,
    HEADSET.x,
    (HEADSET.hookY + DESK_Y) / 2,
    HEADSET.z,
    'y',
    20,
  );
  b.rounded(2.4, 1.2, 9, 0.5, metal, HEADSET.x, HEADSET.hookY, HEADSET.z);
}

// Écran

/** Écran : dimensions réelles d'après la diagonale et le format (16:9, 21:9, 32:9…) */
export function buildMonitor(b: Builder, part: ConfiguratorPart | null) {
  const diagonal = part?.monitor?.screenSizeIn ?? 27;
  const aspect = part?.monitor
    ? part.monitor.resolutionWidth / part.monitor.resolutionHeight
    : 16 / 9;
  const width = (diagonal * 2.54 * aspect) / Math.sqrt(aspect * aspect + 1);
  const height = width / aspect;
  const bottom = DESK_Y + 11;
  const centerY = bottom + height / 2;
  const { x, z } = MONITOR;

  if (!part) {
    b.ghost(width + 1.6, height + 1.6, 2.4, x, centerY, z);
    return;
  }
  const white = isWhite(part);
  const body = b.physical(white ? 0xe8eaef : 0x16181d, {
    metalness: 0.4,
    roughness: 0.4,
    clearcoat: 0.3,
  });

  // Pied et colonne
  b.rounded(Math.min(30, width * 0.45), 1.2, 19, 0.5, body, x, DESK_Y + 0.6, z - 2);
  b.rounded(5.5, bottom - DESK_Y + 4, 2.6, 0.6, body, x, (bottom + DESK_Y) / 2 + 2, z - 4.6);
  // Coque, renfort arrière, bandeau RGB arrière (écrans gaming)
  b.rounded(width + 1.6, height + 1.6, 2.2, 0.5, body, x, centerY, z);
  b.rounded(width * 0.55, height * 0.6, 2.6, 1, body, x, centerY, z - 2.2);
  if (isRgb(part) || (part.monitor?.refreshRateHz ?? 0) >= 144) {
    b.strip(width * 0.5, 0.3, 0.3, x, centerY + height * 0.3, z - 3.6);
  }

  // Dalle allumée : fond d'écran ByteBazaar (dégradé, vagues RGB, fréquence)
  const screen = b.track(
    canvasTexture(1024, Math.round(1024 / aspect), (ctx) => {
      const { width: w, height: h } = ctx.canvas;
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0b1230');
      bg.addColorStop(0.55, '#1b1450');
      bg.addColorStop(1, '#0a2238');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `hsla(${200 + i * 28}, 90%, 60%, 0.55)`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let px = 0; px <= w; px += 16) {
          const py = h * 0.62 + Math.sin(px / (110 + i * 14) + i) * h * 0.09 + i * 9;
          if (px === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `800 ${Math.round(h * 0.12)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ByteBazaar', w / 2, h * 0.38);
      ctx.fillStyle = 'rgba(200,210,255,0.75)';
      ctx.font = `600 ${Math.round(h * 0.045)}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(
        `${diagonal}" · ${part.monitor?.refreshRateHz ?? ''} Hz · ${part.monitor?.panelType ?? ''}`,
        w / 2,
        h * 0.47,
      );
    }),
  );
  const panel = new THREE.Mesh(
    b.track(new THREE.PlaneGeometry(width, height)),
    b.track(new THREE.MeshBasicMaterial({ map: screen })),
  );
  panel.userData['noShadow'] = true;
  b.add(panel, x, centerY, z + 1.12);

  const brand = b.label(
    [
      {
        text: part.brand.toUpperCase(),
        size: 0.42,
        color: white ? '#5a6070' : '#9aa3b5',
        spacing: 3,
      },
    ],
    10,
    0.6,
  );
  b.add(brand, x, bottom - 0.25, z + 1.12);
}

// Clavier

/** Clavier : complet (44 cm), TKL (36 cm) ou compact 60 % (29 cm), touches instanciées */
export function buildKeyboard(b: Builder, part: ConfiguratorPart | null) {
  const compact =
    /mini|60|65/i.test(`${part?.keyboard?.style ?? ''} ${part?.name ?? ''}`) &&
    !!part?.keyboard?.tenkeyless;
  const width = compact ? 29 : part?.keyboard?.tenkeyless ? 36 : 44;
  const depth = compact ? 10.5 : 13.5;
  const { x, z } = KEYBOARD;

  if (!part) {
    b.ghost(44, 3, 13.5, x, MAT_Y + 1.5, z);
    return;
  }
  const white = isWhite(part);
  const caseMat = b.physical(productColor(part, 0x1a1c22), { metalness: 0.55, roughness: 0.38 });
  b.rounded(width, 2, depth, 0.6, caseMat, x, MAT_Y + 1, z);

  // Rétroéclairage visible entre les touches
  const backlight = part.keyboard?.backlight ?? '';
  if (isRgb(part)) b.strip(width - 1.2, 0.12, depth - 1.2, x, MAT_Y + 2.06, z);
  else if (backlight)
    b.box(
      width - 1.2,
      0.12,
      depth - 1.2,
      b.mat(0x000000, { emissive: 0xdfe8ff, emissiveIntensity: 1.6 }),
      x,
      MAT_Y + 2.06,
      z,
    );

  // Touches : une seule InstancedMesh (rangées de 1,9 cm, barre d'espace à part)
  const rows = compact ? 5 : 6;
  const cols = Math.floor((width - 1.2) / 1.9);
  const capMat = b.mat(white ? 0xf4f5f8 : 0x23262e, { roughness: 0.55, metalness: 0.05 });
  const keyGeo = b.track(new THREE.BoxGeometry(1.6, 0.9, 1.6));
  const keys = b.track(new THREE.InstancedMesh(keyGeo, capMat, rows * cols));
  const matrix = new THREE.Matrix4();
  const x0 = x - ((cols - 1) * 1.9) / 2;
  const z0 = z - ((rows - 1) * 1.9) / 2;
  const spaceFrom = Math.floor(cols * 0.3);
  const spaceTo = Math.ceil(cols * 0.68);
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c >= spaceFrom && c < spaceTo) continue; // barre d'espace
      matrix.makeTranslation(x0 + c * 1.9, MAT_Y + 2.55, z0 + r * 1.9);
      keys.setMatrixAt(count++, matrix);
    }
  }
  keys.count = count;
  keys.instanceMatrix.needsUpdate = true;
  b.view.group.add(keys);
  b.box(
    (spaceTo - spaceFrom) * 1.9 - 0.3,
    0.9,
    1.6,
    capMat,
    x0 + ((spaceFrom + spaceTo - 1) * 1.9) / 2,
    MAT_Y + 2.55,
    z0 + (rows - 1) * 1.9,
  );

  // Câble (claviers filaires) vers l'arrière du bureau
  if (!part.keyboard?.wireless) {
    const cable = b.mat(0x111215, { roughness: 0.7 });
    b.tube(
      [
        new THREE.Vector3(x, MAT_Y + 1, z - depth / 2),
        new THREE.Vector3(x + 2, DESK_Y + 0.4, z - depth / 2 - 6),
        new THREE.Vector3(x + 8, DESK_Y + 0.4, -36),
      ],
      0.22,
      cable,
    );
  }
}

// Souris

export function buildMouse(b: Builder, part: ConfiguratorPart | null) {
  const { x, z } = MOUSE;
  if (!part) {
    b.ghost(6.8, 4, 12, x, MAT_Y + 2, z);
    return;
  }
  const shellMat = b.physical(productColor(part), {
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 0.8,
  });

  // Coque ergonomique : sphère étirée, plus large à l'arrière
  const shell = new THREE.Mesh(b.track(new THREE.SphereGeometry(1, 40, 24)), shellMat);
  shell.scale.set(3.2, 1.9, 6);
  b.add(shell, x, MAT_Y + 0.9, z);
  // Séparation des clics, molette, logo RGB
  b.box(0.12, 0.25, 4.5, b.mat(0x0b0c10), x, MAT_Y + 2.72, z - 2.6);
  b.cylinder(0.42, 0.55, b.mat(0x2c3038, { roughness: 0.8 }), x, MAT_Y + 2.75, z - 3, 'x', 20);
  // Logo lumineux (souris gaming / RGB), même éclairage synchronisé que le PC
  if (isRgb(part) || /\b(logitech|razer|steelseries|corsair|hyperx|asus|msi)\b/i.test(part.brand)) {
    const logo = b.add(b.glowMesh(new THREE.CircleGeometry(0.7, 24)), x, MAT_Y + 2.66, z + 2.2);
    logo.rotation.x = -Math.PI / 2 - 0.3;
  }
  // Câble (souris filaires)
  if (!part.mouse?.wireless) {
    b.tube(
      [
        new THREE.Vector3(x, MAT_Y + 1, z - 6),
        new THREE.Vector3(x - 1, DESK_Y + 0.4, z - 14),
        new THREE.Vector3(x - 6, DESK_Y + 0.4, -36),
      ],
      0.18,
      b.mat(0x111215, { roughness: 0.7 }),
    );
  }
}

// Casque

/** Casque posé sur son support : arceau, oreillettes, coussinets, micro et anneaux RGB */
export function buildHeadset(b: Builder, part: ConfiguratorPart | null) {
  const { x, z, hookY } = HEADSET;
  const center = hookY - 9.2;
  if (!part) {
    b.ghost(23, 21, 10, x, center - 1, z);
    return;
  }
  const white = isWhite(part);
  const shellMat = b.physical(productColor(part, 0x1c1e24), {
    metalness: 0.35,
    roughness: 0.4,
    clearcoat: 0.5,
  });
  const cushion = b.mat(white ? 0xd9dce3 : 0x0f1013, { roughness: 0.95, metalness: 0 });

  // Arceau (demi-tore) reposant sur le crochet
  const band = new THREE.Mesh(
    b.track(new THREE.TorusGeometry(9.2, 0.95, 14, 56, Math.PI)),
    shellMat,
  );
  b.add(band, x, center, z);
  const pad = new THREE.Mesh(
    b.track(new THREE.TorusGeometry(8.4, 0.7, 10, 40, Math.PI * 0.6)),
    cushion,
  );
  pad.rotation.z = Math.PI * 0.2;
  b.add(pad, x, center, z);

  for (const side of [-1, 1]) {
    const cx = x + side * 9.6;
    // Fourche + oreillette + coussinet orienté vers l'intérieur
    b.box(1, 4, 1.4, shellMat, cx, center - 1.6, z);
    b.cylinder(4.6, 3.2, shellMat, cx, center - 5.2, z, 'x', 40);
    const ear = new THREE.Mesh(b.track(new THREE.TorusGeometry(3.6, 1.05, 14, 40)), cushion);
    ear.rotation.y = Math.PI / 2;
    b.add(ear, cx - side * 1.9, center - 5.2, z);
    // Anneau lumineux sur la face extérieure
    if (isRgb(part)) {
      const ring = b.add(
        b.glowMesh(new THREE.TorusGeometry(3.4, 0.22, 10, 48)),
        cx + side * 1.65,
        center - 5.2,
        z,
      );
      ring.rotation.y = Math.PI / 2;
    }
  }

  // Micro perche (casques avec micro, sauf intra-auriculaires)
  if (part.headset?.microphone) {
    b.tube(
      [
        new THREE.Vector3(x - 11.2, center - 6.5, z + 1.5),
        new THREE.Vector3(x - 11.6, center - 9.5, z + 5),
        new THREE.Vector3(x - 9, center - 11, z + 8.5),
      ],
      0.32,
      shellMat,
    );
    b.cylinder(
      0.7,
      1.6,
      b.mat(0x0c0d10, { roughness: 0.9 }),
      x - 8.6,
      center - 11.1,
      z + 8.8,
      'x',
      16,
    );
  }
}
