// Modèle 3D procédural du PC ouvert (Three.js, sans fichier externe).
// Repère en cm : x = profondeur (-22 arrière → +22 façade), y = hauteur (0 → 46),
// z = largeur (-10,5 plateau → +10,5 vitre) ; la caméra regarde la vitre (+z).
// Chaque emplacement est un groupe reconstruit quand la sélection change : fantôme
// s'il est vide, pièce dimensionnée d'après ses caractéristiques sinon.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  DESK_SLOTS,
  PC_SLOTS,
  type ConfiguratorPart,
  type FormFactor,
  type Slot,
} from '../core/configurator-api';
import { buildDesk, buildHeadset, buildKeyboard, buildMonitor, buildMouse } from './desk-model';
import { canvasTexture, seeded } from './three-utils';

export type Selection = Record<Slot, ConfiguratorPart | null>;

// Ordre de construction (le boîtier d'abord : les autres pièces s'y logent)
const PC_ORDER: Slot[] = ['case', 'motherboard', 'psu', 'storage', 'gpu', 'ram', 'cpu', 'cooler'];
const BUILD_ORDER: Slot[] = [...PC_ORDER, ...DESK_SLOTS];

/** Cible de survol : une pièce, ou le PC entier en vue d'ensemble */
export type HoverTarget = Slot | 'pc';
/** Vue d'ensemble (bureau) ou intérieur du PC */
export type SceneMode = 'desk' | 'pc';

const BOARD_SIZE: Record<FormFactor, [number, number]> = {
  ATX: [24.4, 30.5],
  MICRO_ATX: [24.4, 24.4],
  MINI_ITX: [17, 17],
  E_ATX: [30.5, 33],
};

const TRAY_Z = -9.3; // surface de la carte mère
const BOARD_LEFT = -21;
const BOARD_TOP = 44;
const SHROUD_TOP = 10.8; // dessus du cache-alimentation
const GPU_BRACKET_X = -21.4;

interface Layout {
  board: { x0: number; y0: number; w: number; h: number; right: number };
  cpu: { x: number; y: number };
  ram: { x: number; y: number; slots: number };
  m2: { x: number; y: number };
  gpu: { top: number; length: number; end: number };
  floorY: number;
  /** Radiateur de watercooling AIO (mm) monté en haut du boîtier, sinon null */
  aioMm: number | null;
}

function layoutFor(sel: Selection): Layout {
  const formFactor = sel.motherboard?.motherboard?.formFactor ?? 'ATX';
  const [w, h] = BOARD_SIZE[formFactor];
  const itx = formFactor === 'MINI_ITX';
  const y0 = BOARD_TOP - h;
  const cpu = { x: BOARD_LEFT + (itx ? 7.5 : 9.5), y: BOARD_TOP - (itx ? 6.5 : 8.5) };
  const length = Math.min(36, Math.max(17, (sel.gpu?.gpu?.lengthMm ?? 280) / 10));
  return {
    board: { x0: BOARD_LEFT, y0, w, h, right: BOARD_LEFT + w },
    cpu,
    ram: {
      x: cpu.x + (itx ? 5.8 : 7),
      y: cpu.y - 1,
      slots: sel.motherboard?.motherboard?.ramSlots ?? (itx ? 2 : 4),
    },
    m2: { x: cpu.x, y: itx ? cpu.y - 6.6 : cpu.y - 8.2 },
    gpu: { top: itx ? y0 + 1.5 : BOARD_TOP - 21, length, end: GPU_BRACKET_X + length },
    floorY: sel.case ? SHROUD_TOP : 0.8,
    aioMm: sel.cooler?.cooler?.liquid
      ? Math.min(420, Math.max(120, sel.cooler.cooler.radiatorMm ?? 240))
      : null,
  };
}

const isWhite = (part: ConfiguratorPart | null) => !!part && /\b(white|blanc)\b/i.test(part.name);

/** Textures partagées par toutes les pièces (créées une fois). */
class SharedTextures {
  // Arc-en-ciel qui défile : source de tout l'éclairage RGB
  readonly rainbow = canvasTexture(512, 4, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 0);
    for (let i = 0; i <= 12; i++) gradient.addColorStop(i / 12, `hsl(${i * 30}, 100%, 55%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 4);
  });

  // Gaine tressée des câbles
  readonly braid = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#121318';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#2c2f38';
    ctx.lineWidth = 5;
    for (let i = -64; i < 128; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 64, 64);
      ctx.stroke();
    }
  });

  // Aluminium brossé (radiateurs, équerres)
  readonly brushed = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#9da3ad';
    ctx.fillRect(0, 0, 256, 256);
    const rand = seeded(7);
    for (let i = 0; i < 900; i++) {
      const v = rand() > 0.5 ? 255 : 40;
      ctx.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.06})`;
      ctx.fillRect(0, rand() * 256, 256, 1);
    }
  });

  // Tôle perforée en nid d'abeille (façade) : masque alpha
  readonly hexMesh = canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#000';
      const r = 9;
      for (let row = -1; row < 10; row++) {
        for (let col = -1; col < 10; col++) {
          const cx = col * r * 1.75 + (row % 2 ? r * 0.875 : 0);
          const cy = row * r * 1.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            ctx.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
          }
          ctx.fill();
        }
      }
    },
    false,
  );

  constructor() {
    this.rainbow.wrapS = THREE.RepeatWrapping;
    for (const t of [this.braid, this.brushed, this.hexMesh]) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
    }
  }

  dispose() {
    [this.rainbow, this.braid, this.brushed, this.hexMesh].forEach((t) => t.dispose());
  }
}

interface RgbMaterials {
  ring: THREE.MeshStandardMaterial;
  blade: THREE.MeshStandardMaterial;
  strip: THREE.MeshStandardMaterial;
}

export interface SlotView {
  slot: Slot;
  group: THREE.Group;
  partId: number | null;
  mats: THREE.MeshStandardMaterial[]; // matériaux qui s'illuminent au survol
  ghostFills: THREE.MeshBasicMaterial[];
  ghostEdges: THREE.LineBasicMaterial[];
  accentMats: (THREE.MeshBasicMaterial | THREE.LineBasicMaterial)[];
  disposables: { dispose(): void }[];
  install: number; // 0 → 1 : animation d'installation
  lift: number; // décalage vers l'avant au survol
  axis: 'z' | 'y'; // pièces du PC : glissent vers la vitre ; poste de travail : se posent d'en haut
}

export class Builder {
  constructor(
    readonly view: SlotView,
    private readonly accent: THREE.Color,
    private readonly tex: SharedTextures,
    private readonly rgb: RgbMaterials,
    private readonly spinners: THREE.Object3D[],
  ) {}

  track<T extends { dispose(): void }>(item: T): T {
    this.view.disposables.push(item);
    return item;
  }

  mat(color: THREE.ColorRepresentation, opts: THREE.MeshStandardMaterialParameters = {}) {
    const m = this.track(
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.55, ...opts }),
    );
    this.view.mats.push(m);
    return m;
  }

  physical(color: THREE.ColorRepresentation, opts: THREE.MeshPhysicalMaterialParameters = {}) {
    const m = this.track(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.4,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        ...opts,
      }),
    );
    this.view.mats.push(m);
    return m;
  }

  brushed(tint: THREE.ColorRepresentation = 0xffffff) {
    return this.mat(tint, { map: this.tex.brushed, metalness: 0.85, roughness: 0.32 });
  }

  add<T extends THREE.Object3D>(
    object: T,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = this.view.group,
  ): T {
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  box(
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent?: THREE.Object3D,
  ) {
    return this.add(
      new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, d)), material),
      x,
      y,
      z,
      parent,
    );
  }

  rounded(
    w: number,
    h: number,
    d: number,
    r: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const radius = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
    return this.add(
      new THREE.Mesh(this.track(new RoundedBoxGeometry(w, h, d, 3, radius)), material),
      x,
      y,
      z,
    );
  }

  cylinder(
    r: number,
    length: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    axis: 'x' | 'y' | 'z',
    segments = 20,
  ) {
    const mesh = this.add(
      new THREE.Mesh(this.track(new THREE.CylinderGeometry(r, r, length, segments)), material),
      x,
      y,
      z,
    );
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  /** Forme quelconque éclairée en RGB (anneaux, logos). */
  glowMesh(geometry: THREE.BufferGeometry) {
    const mesh = new THREE.Mesh(this.track(geometry), this.rgb.ring);
    mesh.userData['noShadow'] = true;
    return mesh;
  }

  /** Bandeau LED RGB orienté selon x (à faire pivoter si besoin). */
  strip(length: number, thick: number, depth: number, x: number, y: number, z: number) {
    const mesh = this.box(length, thick, depth, this.rgb.strip, x, y, z);
    mesh.userData['noShadow'] = true;
    return mesh;
  }

  tube(points: THREE.Vector3[], radius: number, material: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
    return this.add(
      new THREE.Mesh(this.track(new THREE.TubeGeometry(curve, 48, radius, 10, false)), material),
    );
  }

  /** Volume « fantôme » : remplissage translucide + arêtes aux couleurs du thème. */
  ghost(w: number, h: number, d: number, x: number, y: number, z: number) {
    const geometry = this.track(new THREE.BoxGeometry(w, h, d));
    const fill = this.track(
      new THREE.MeshBasicMaterial({
        color: this.accent,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      }),
    );
    const edge = this.track(
      new THREE.LineBasicMaterial({ color: this.accent, transparent: true, opacity: 0.75 }),
    );
    this.view.ghostFills.push(fill);
    this.view.ghostEdges.push(edge);
    this.view.accentMats.push(fill, edge);

    const mesh = this.add(new THREE.Mesh(geometry, fill), x, y, z);
    mesh.userData['noShadow'] = true;
    const edges = new THREE.LineSegments(this.track(new THREE.EdgesGeometry(geometry)), edge);
    edges.raycast = () => undefined;
    mesh.add(edges);
    return mesh;
  }

  /** Étiquette imprimée sur une face (texture dessinée sur un canvas). */
  label(
    lines: { text: string; size: number; color?: string; weight?: number; spacing?: number }[],
    w: number,
    h: number,
  ) {
    const scale = 64;
    const texture = this.track(
      canvasTexture(Math.round(w * scale), Math.round(h * scale), (ctx) => {
        const { width, height } = ctx.canvas;
        const total = lines.reduce((sum, l) => sum + l.size * scale * 1.25, 0);
        let y = (height - total) / 2;
        for (const line of lines) {
          const px = line.size * scale;
          ctx.font = `${line.weight ?? 800} ${px}px "Segoe UI", system-ui, sans-serif`;
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
            `${line.spacing ?? 0}px`;
          ctx.fillStyle = line.color ?? '#e8ecf5';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          let text = line.text;
          while (ctx.measureText(text).width > width * 0.94 && text.length > 4)
            text = text.slice(0, -2);
          if (text !== line.text) text = text.trimEnd() + '…';
          ctx.fillText(text, width / 2, y);
          y += px * 1.25;
        }
      }),
    );
    const material = this.track(new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
    const mesh = new THREE.Mesh(this.track(new THREE.PlaneGeometry(w, h)), material);
    mesh.userData['noShadow'] = true;
    return mesh;
  }

  /**
   * Ventilateur RGB orienté vers +z : cadre carré (optionnel), pales incurvées
   * translucides et double anneau LED. Ajouter au parent puis orienter.
   */
  fan(size: number, lit: boolean, framed = true) {
    const fan = new THREE.Group();
    const radius = size * 0.44;
    const depth = size * 0.21;

    if (framed) {
      const half = size / 2;
      const c = size * 0.08;
      const shape = new THREE.Shape();
      shape.moveTo(-half + c, -half);
      shape.lineTo(half - c, -half);
      shape.quadraticCurveTo(half, -half, half, -half + c);
      shape.lineTo(half, half - c);
      shape.quadraticCurveTo(half, half, half - c, half);
      shape.lineTo(-half + c, half);
      shape.quadraticCurveTo(-half, half, -half, half - c);
      shape.lineTo(-half, -half + c);
      shape.quadraticCurveTo(-half, -half, -half + c, -half);
      const hole = new THREE.Path();
      hole.absarc(0, 0, radius + 0.15, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const frameGeo = this.track(
        new THREE.ExtrudeGeometry(shape, {
          depth,
          bevelEnabled: true,
          bevelSize: 0.08,
          bevelThickness: 0.08,
          bevelSegments: 2,
          curveSegments: 40,
        }),
      );
      frameGeo.translate(0, 0, -depth / 2);
      fan.add(new THREE.Mesh(frameGeo, this.mat(0x14161c, { roughness: 0.65, metalness: 0.1 })));
      // Coins en caoutchouc anti-vibration
      const rubber = this.mat(0x2b2f38, { roughness: 0.95, metalness: 0 });
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        this.box(
          size * 0.14,
          size * 0.14,
          depth + 0.1,
          rubber,
          sx * (half - size * 0.07),
          sy * (half - size * 0.07),
          0,
          fan,
        );
      }
    }

    // Anneaux LED avant et arrière (effet « double anneau » des ventilateurs RGB)
    const ringGeo = this.track(new THREE.TorusGeometry(radius, size * 0.028, 10, 64));
    const ringMat = lit ? this.rgb.ring : this.mat(0x3a3f4a, { roughness: 0.6 });
    for (const z of [depth / 2 + 0.02, -depth / 2 - 0.02]) {
      const ring = this.add(new THREE.Mesh(ringGeo, ringMat), 0, 0, z, fan);
      ring.userData['noShadow'] = true;
    }

    // Moyeu + pales incurvées
    const hub = this.add(
      new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(radius * 0.32, radius * 0.32, depth * 0.85, 32)),
        this.mat(0x1a1d24, { roughness: 0.4 }),
      ),
      0,
      0,
      0,
      fan,
    );
    hub.rotation.x = Math.PI / 2;
    const cap = this.add(
      new THREE.Mesh(
        this.track(new THREE.CircleGeometry(radius * 0.3, 32)),
        lit ? this.rgb.ring : this.mat(0x2a2e38),
      ),
      0,
      0,
      depth * 0.43,
      fan,
    );
    cap.userData['noShadow'] = true;

    const blades = new THREE.Group();
    const r0 = radius * 0.3;
    const r1 = radius * 0.97;
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(r0, -r0 * 0.55);
    bladeShape.quadraticCurveTo((r0 + r1) / 2, -radius * 0.42, r1, -radius * 0.12);
    bladeShape.quadraticCurveTo(r1 * 1.02, radius * 0.18, r1 * 0.92, radius * 0.3);
    bladeShape.quadraticCurveTo((r0 + r1) / 2, radius * 0.05, r0, r0 * 0.55);
    const bladeGeo = this.track(
      new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.06,
        bevelEnabled: false,
        curveSegments: 12,
      }),
    );
    const bladeMat = lit ? this.rgb.blade : this.mat(0x2e323c, { roughness: 0.35 });
    const count = 9;
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.z = (i / count) * Math.PI * 2;
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.x = 0.42; // incidence de la pale
      pivot.add(blade);
      blades.add(pivot);
    }
    fan.add(blades);
    this.spinners.push(blades);
    return fan;
  }
}

export class PcModel {
  readonly root = new THREE.Group();
  /** Le PC (boîtier et pièces), à droite sur le bureau */
  private readonly pcRoot = new THREE.Group();
  /** Décor fixe : bureau, tapis, support de casque */
  private readonly deskRoot = new THREE.Group();
  private readonly deskDisposables: { dispose(): void }[] = [];

  private readonly accent = new THREE.Color();
  private readonly tex = new SharedTextures();
  private readonly views = new Map<Slot, SlotView>();
  private spinners: THREE.Object3D[] = [];
  private hovered: HoverTarget | null = null;
  private rgbOn = false;
  /** Mode performance : LED éteintes, ventilateurs à l'arrêt, lumières colorées coupées */
  private lowGraphics = false;

  // Éclairage RGB partagé (texture arc-en-ciel animée)
  private readonly rgb: RgbMaterials = {
    ring: new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: this.tex.rainbow,
      emissiveIntensity: 3.4,
      roughness: 0.3,
    }),
    strip: new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: this.tex.rainbow,
      emissiveIntensity: 3,
      roughness: 0.3,
    }),
    blade: new THREE.MeshStandardMaterial({
      color: 0xf2f4ff,
      emissive: 0xffffff,
      emissiveMap: this.tex.rainbow,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.55,
      roughness: 0.25,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };

  // Lumières colorées qui reprennent les teintes RGB à l'intérieur du boîtier
  private readonly rgbLights = [
    { light: new THREE.PointLight(0xffffff, 0, 34, 0), phase: 0 },
    { light: new THREE.PointLight(0xffffff, 0, 34, 0), phase: 0.33 },
    { light: new THREE.PointLight(0xffffff, 0, 30, 0), phase: 0.66 },
  ];

  constructor(accent: string) {
    this.accent.set(accent);
    const positions = [
      [16, 32, 2],
      [-4, 42, 2],
      [2, 14, 4],
    ];
    this.rgbLights.forEach(({ light }, i) => {
      light.position.set(positions[i][0], positions[i][1], positions[i][2]);
      this.pcRoot.add(light);
    });
    this.root.add(this.pcRoot, this.deskRoot);

    // Décor du bureau (construit une fois ; jamais survolable)
    const deskView = this.emptyView('case', this.deskRoot);
    buildDesk(new Builder(deskView, this.accent, this.tex, this.rgb, []));
    this.deskDisposables.push(...deskView.disposables);
    this.applyShadows(this.deskRoot);
  }

  private emptyView(slot: Slot, group = new THREE.Group()): SlotView {
    return {
      slot,
      group,
      partId: null,
      mats: [],
      ghostFills: [],
      ghostEdges: [],
      accentMats: [],
      disposables: [],
      install: 1,
      lift: 0,
      axis: (DESK_SLOTS as Slot[]).includes(slot) ? 'y' : 'z',
    };
  }

  // API

  setSelection(selection: Selection, animate: boolean) {
    this.spinners.length = 0;
    for (const slot of BUILD_ORDER) {
      const part = selection[slot];
      const old = this.views.get(slot);
      const changed = (old?.partId ?? null) !== (part?.id ?? null);
      // Le poste de travail ne dépend que de sa propre pièce : inutile de le reconstruire sinon
      if (old && old.axis === 'y' && !changed) continue;
      const parent = (PC_SLOTS as Slot[]).includes(slot) ? this.pcRoot : this.root;
      if (old) {
        parent.remove(old.group);
        old.disposables.forEach((d) => d.dispose());
      }
      const view = this.build(slot, selection);
      view.install = animate && changed && !!part ? 0 : 1;
      view.lift = old?.lift ?? 0;
      this.views.set(slot, view);
      parent.add(view.group);
    }
    this.rgbOn = !!selection.case;
    this.applyHover();
  }

  /** Active / désactive le mode performance (graphismes allégés). */
  setLowGraphics(on: boolean) {
    this.lowGraphics = on;
    // LED éteintes : plastique sombre mat, sans émission (donc sans halo)
    this.rgb.ring.emissiveIntensity = on ? 0 : 3.4;
    this.rgb.strip.emissiveIntensity = on ? 0 : 3;
    this.rgb.blade.emissiveIntensity = on ? 0 : 0.55;
    for (const m of [this.rgb.ring, this.rgb.strip]) m.color.set(on ? 0x2a2d35 : 0x000000);
    for (const { light } of this.rgbLights) light.visible = !on;
  }

  setAccent(color: string) {
    this.accent.set(color);
    for (const view of this.views.values())
      for (const m of view.accentMats) m.color.copy(this.accent);
    this.applyHover();
  }

  setHover(target: HoverTarget | null) {
    if (target === this.hovered) return;
    this.hovered = target;
    this.applyHover();
  }

  /**
   * Objets testés par le lancer de rayon. En vue d'ensemble, le PC est une seule cible
   * (ses pièces ne réagissent pas individuellement) ; dans le PC, seules ses pièces comptent.
   */
  hitTargets(mode: SceneMode): THREE.Object3D[] {
    const views = [...this.views.values()];
    if (mode === 'pc') return views.filter((v) => v.axis === 'z').map((v) => v.group);
    return [this.pcRoot, ...views.filter((v) => v.axis === 'y').map((v) => v.group)];
  }

  slotOf(object: THREE.Object3D | null, mode: SceneMode): HoverTarget | null {
    for (let o = object; o; o = o.parent) {
      if (o.userData['noHit']) return null;
      if (mode === 'desk' && o === this.pcRoot) return 'pc';
      if (o.userData['slot'] && !(mode === 'desk' && this.isInPc(o)))
        return o.userData['slot'] as Slot;
    }
    return null;
  }

  private isInPc(object: THREE.Object3D) {
    for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o === this.pcRoot) return true;
    return false;
  }

  /** Point d'ancrage (haut de l'élément) pour positionner l'info-bulle. */
  anchorOf(target: HoverTarget, out: THREE.Vector3) {
    const object = target === 'pc' ? this.pcRoot : this.views.get(target)?.group;
    if (!object) return out.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(object);
    if (target === 'case') return out.set(box.max.x - 4, box.max.y, box.max.z);
    return box.getCenter(out).setY(box.max.y);
  }

  update(dt: number, time: number, reducedMotion: boolean) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    for (const view of this.views.values()) {
      // Installation : la pièce glisse depuis l'ouverture du boîtier
      if (view.install < 1) view.install = reducedMotion ? 1 : Math.min(1, view.install + dt * 1.6);
      const ease = 1 - Math.pow(1 - view.install, 3);
      const targetLift =
        view.slot === this.hovered && view.slot !== 'case' ? (view.axis === 'y' ? 1.2 : 0.9) : 0;
      view.lift += (targetLift - view.lift) * Math.min(1, dt * 10);
      // Pièces du PC : glissent depuis la vitre ; poste de travail : se posent depuis le dessus
      if (view.axis === 'z') view.group.position.z = (1 - ease) * 14 + view.lift;
      else view.group.position.y = (1 - ease) * 22 + view.lift;
      view.group.scale.setScalar(0.92 + 0.08 * ease);

      const hovered = view.slot === this.hovered;
      for (const fill of view.ghostFills) fill.opacity = hovered ? 0.3 : 0.07 + 0.07 * pulse;
      for (const edge of view.ghostEdges) edge.opacity = hovered ? 1 : 0.45 + 0.35 * pulse;
    }

    if (this.lowGraphics) return;
    // Vague arc-en-ciel synchronisée sur toutes les LED
    if (!reducedMotion) this.tex.rainbow.offset.x = (this.tex.rainbow.offset.x + dt * 0.12) % 1;
    const hueBase = 1 - this.tex.rainbow.offset.x;
    for (const { light, phase } of this.rgbLights) {
      light.color.setHSL((hueBase + phase) % 1, 1, 0.55);
      light.intensity = this.rgbOn ? 1.5 : 0;
    }
    if (!reducedMotion) for (const s of this.spinners) s.rotation.z += dt * 9;
  }

  dispose() {
    this.deskDisposables.forEach((d) => d.dispose());
    for (const view of this.views.values()) view.disposables.forEach((d) => d.dispose());
    this.views.clear();
    Object.values(this.rgb).forEach((m) => m.dispose());
    this.tex.dispose();
  }

  // Construction

  private applyHover() {
    const wholePc = this.hovered === 'pc';
    for (const view of this.views.values()) {
      const on = view.slot === this.hovered || (wholePc && view.axis === 'z');
      for (const m of view.mats) {
        m.emissive.copy(on ? this.accent : new THREE.Color(0x000000));
        m.emissiveIntensity = on ? (wholePc ? 0.2 : 0.4) : 0;
      }
    }
  }

  private applyShadows(group: THREE.Object3D) {
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as THREE.Material;
      const skip = !!o.userData['noShadow'] || material.transparent;
      o.castShadow = !skip && !o.userData['noCast'];
      o.receiveShadow = !skip;
    });
  }

  private build(slot: Slot, sel: Selection): SlotView {
    const view = this.emptyView(slot);
    view.group.userData['slot'] = slot;
    view.partId = sel[slot]?.id ?? null;
    const group = view.group;
    const b = new Builder(view, this.accent, this.tex, this.rgb, this.spinners);
    const layout = layoutFor(sel);
    const part = sel[slot];

    switch (slot) {
      case 'case':
        this.buildCase(b, part, layout);
        break;
      case 'motherboard':
        this.buildMotherboard(b, part, layout);
        break;
      case 'cpu':
        this.buildCpu(b, part, layout);
        break;
      case 'ram':
        this.buildRam(b, part, layout);
        break;
      case 'gpu':
        this.buildGpu(b, part, layout);
        break;
      case 'storage':
        this.buildStorage(b, part, layout);
        break;
      case 'psu':
        this.buildPsu(b, part, sel, layout);
        break;
      case 'cooler':
        this.buildCooler(b, part, layout);
        break;
      case 'monitor':
        buildMonitor(b, part);
        break;
      case 'keyboard':
        buildKeyboard(b, part);
        break;
      case 'mouse':
        buildMouse(b, part);
        break;
      case 'headset':
        buildHeadset(b, part);
        break;
    }

    // Ombres : les pièces en projettent et en reçoivent, sauf éléments lumineux / fantômes
    this.applyShadows(group);
    return view;
  }

  // Boîtier

  private buildCase(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    if (!part) {
      // Boîtier non choisi : coque translucide + contour lumineux qui pulse
      const shell = b.mat(0x6b7280, { transparent: true, opacity: 0.18, depthWrite: false });
      b.box(44.4, 46.4, 0.4, shell, 0, 23, -10.7);
      b.box(44.4, 0.4, 21.8, shell, 0, 46.2, 0);
      b.box(44.4, 0.4, 21.8, shell, 0, -0.2, 0);
      b.box(0.6, 46.4, 21.8, shell, 22.3, 23, 0);
      b.box(0.4, 46.4, 21.8, shell, -22.2, 23, 0);
      const geometry = b.track(new THREE.BoxGeometry(44.4, 46.4, 21.8));
      const edge = b.track(
        new THREE.LineBasicMaterial({ color: this.accent, transparent: true, opacity: 0.6 }),
      );
      const outline = b.add(
        new THREE.LineSegments(b.track(new THREE.EdgesGeometry(geometry)), edge),
        0,
        23,
        0,
      );
      outline.raycast = () => undefined;
      b.view.ghostEdges.push(edge);
      b.view.accentMats.push(edge);
      for (const y of [16, 28, 40]) b.add(b.fan(11.6, false), 20.5, y, 0).rotation.y = Math.PI / 2;
      return;
    }

    const white = isWhite(part);
    const steel = b.physical(white ? 0xeceef2 : 0x23272f, {
      metalness: white ? 0.1 : 0.45,
      roughness: white ? 0.6 : 0.5,
      clearcoat: 0.25,
    });
    // Acier thermolaqué mat à l'intérieur (peu de reflets)
    const interior = b.mat(white ? 0xdfe2e8 : 0x15181e, { metalness: 0.2, roughness: 0.82 });
    const trim = b.mat(white ? 0xd2d6de : 0x0f1116, { metalness: 0.5, roughness: 0.45 });

    // Coque à bords arrondis : elle reçoit les ombres mais n'en projette pas sur l'intérieur
    const shellParts = [
      b.rounded(44.6, 46.6, 0.5, 0.2, interior, 0, 23, -10.75), // plateau
      b.rounded(44.6, 0.6, 22, 0.25, steel, 0, 46.3, 0), // dessus
      b.rounded(44.6, 0.6, 22, 0.25, steel, 0, -0.3, 0), // dessous
      b.rounded(0.5, 46.6, 22, 0.2, steel, -22.25, 23, 0), // arrière
    ];
    shellParts.forEach((m) => (m.userData['noCast'] = true));

    // Façade grillagée (tôle perforée en nid d'abeille) : on voit les ventilateurs à travers
    const meshMap = b.track(this.tex.hexMesh.clone());
    meshMap.repeat.set(5, 5);
    meshMap.needsUpdate = true;
    const perforated = b.mat(white ? 0xe4e7ec : 0x1a1d24, {
      alphaMap: meshMap,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      metalness: 0.6,
      roughness: 0.5,
    });
    b.box(0.3, 45.6, 21, perforated, 22.35, 23, 0).userData['noCast'] = true;
    b.box(0.6, 46.6, 1, trim, 22.4, 23, 10.6);
    b.box(0.6, 46.6, 1, trim, 22.4, 23, -10.6);
    b.box(0.6, 1, 22, trim, 22.4, 46, 0);
    b.box(0.6, 1, 22, trim, 22.4, 0, 0);

    // Pieds
    const foot = b.mat(0x0b0c10, { roughness: 0.9 });
    for (const [x, z] of [
      [-18, -7.5],
      [18, -7.5],
      [-18, 7.5],
      [18, 7.5],
    ]) {
      b.rounded(5, 1.3, 3.2, 0.5, foot, x, -1.2, z);
    }

    // Vitre trempée (reflets via l'environnement) + montants
    b.box(44.6, 0.9, 0.5, trim, 0, 45.9, 10.75);
    b.box(44.6, 0.9, 0.5, trim, 0, 0.15, 10.75);
    b.box(0.9, 46.6, 0.5, trim, 21.9, 23, 10.75);
    b.box(0.9, 46.6, 0.5, trim, -21.9, 23, 10.75);
    const glass = b.add(
      new THREE.Mesh(
        b.track(new THREE.BoxGeometry(43, 45, 0.18)),
        b.track(
          // Verre trempé fumé : assombrit légèrement au lieu de voiler l'intérieur
          new THREE.MeshPhysicalMaterial({
            color: 0x0b1018,
            transparent: true,
            opacity: 0.16,
            roughness: 0.05,
            metalness: 0,
            envMapIntensity: 0.04,
            specularIntensity: 0.25,
            depthWrite: false,
          }),
        ),
      ),
      0,
      23,
      10.75,
    );
    glass.userData['noHit'] = true;
    glass.userData['noShadow'] = true;
    glass.raycast = () => undefined;

    // Cache-alimentation (« shroud ») avec fenêtre sur l'alimentation
    b.box(44, 0.4, 20.6, interior, 0, SHROUD_TOP - 0.2, 0);
    const side = new THREE.Shape();
    side.moveTo(-22, 0);
    side.lineTo(22, 0);
    side.lineTo(22, SHROUD_TOP);
    side.lineTo(-22, SHROUD_TOP);
    side.closePath();
    const win = new THREE.Path();
    win.moveTo(-20, 1.6);
    win.lineTo(-6, 1.6);
    win.lineTo(-6, 9.2);
    win.lineTo(-20, 9.2);
    win.closePath();
    side.holes.push(win);
    b.add(
      new THREE.Mesh(
        b.track(new THREE.ExtrudeGeometry(side, { depth: 0.4, bevelEnabled: false })),
        interior,
      ),
      0,
      0,
      9.9,
    );
    const logo = b.label(
      [
        {
          text: part.brand.toUpperCase(),
          size: 1.3,
          color: white ? '#5a6070' : '#c8cfdc',
          spacing: 6,
        },
      ],
      14,
      2.4,
    );
    b.add(logo, 9, 5.4, 10.32);

    // Passe-câbles en caoutchouc dans le plateau
    const rubber = b.mat(0x090a0d, { roughness: 0.95, metalness: 0 });
    const gx = l.board.right + 2.4;
    for (const y of [16, 26, 36]) b.rounded(2.4, 6.5, 0.4, 0.8, rubber, gx, y, -10.35);
    b.rounded(6, 2.2, 0.4, 0.8, rubber, l.board.x0 + 4, 45.4, -10.35);

    // Caches des slots d'extension à l'arrière
    const slotCover = b.brushed(white ? 0xffffff : 0x8a919c);
    for (let i = 0; i < 7; i++)
      b.box(0.15, 1.6, 9.4, slotCover, -21.95, l.gpu.top - 0.8 - i * 2.05, -3.8);

    // Ventilateurs RGB : 3 en façade, 2 au sommet, 1 à l'arrière
    for (const y of [16, 28, 40]) b.add(b.fan(11.6, true), 20.5, y, 0).rotation.y = Math.PI / 2;
    if (!l.aioMm)
      for (const x of [-6.5, 6.5]) b.add(b.fan(11.6, true), x, 44.6, 0).rotation.x = Math.PI / 2;
    b.add(b.fan(11, true), -20.5, 36, 0).rotation.y = Math.PI / 2;

    // Bandeaux LED : montant avant et bord supérieur
    b.strip(44, 0.35, 0.35, 21.4, 23, 9.6).rotation.z = Math.PI / 2;
    b.strip(40, 0.35, 0.35, 0, 45.4, 9.6);
  }

  // Carte mère

  private buildMotherboard(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const { x0, y0, w, h, right } = l.board;
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    if (!part) {
      b.ghost(w, h, 0.3, cx, cy, TRAY_Z - 0.15);
      return;
    }

    // Circuit imprimé : pistes, composants CMS, trous de fixation, sérigraphie
    const px = 40;
    const pcb = b.track(
      canvasTexture(Math.round(w * px), Math.round(h * px), (ctx) => {
        const { width, height } = ctx.canvas;
        const rand = seeded(part.id);
        ctx.fillStyle = '#1f2633';
        ctx.fillRect(0, 0, width, height);
        ctx.lineCap = 'round';
        for (let i = 0; i < 160; i++) {
          ctx.strokeStyle = `rgba(150, 175, 220, ${0.1 + rand() * 0.18})`;
          ctx.lineWidth = 1 + rand() * 1.5;
          ctx.beginPath();
          let x = rand() * width;
          let y = rand() * height;
          ctx.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            const step = (rand() - 0.5) * 260;
            if (rand() > 0.5) x += step;
            else y += step;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < 420; i++) {
          ctx.fillStyle = rand() > 0.7 ? '#b8935a' : '#0e1117';
          ctx.fillRect(rand() * width, rand() * height, 4 + rand() * 6, 2 + rand() * 4);
        }
        ctx.strokeStyle = '#c9ccd3';
        ctx.lineWidth = 3;
        for (const [hx, hy] of [
          [0.04, 0.03],
          [0.96, 0.03],
          [0.04, 0.97],
          [0.96, 0.97],
          [0.04, 0.5],
          [0.96, 0.5],
        ]) {
          ctx.beginPath();
          ctx.arc(hx * width, hy * height, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(225, 230, 240, 0.7)';
        ctx.font = '700 30px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(part.motherboard?.chipset ?? '', width * 0.62, height * 0.94);
        ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(part.motherboard?.socket ?? '', width * 0.3, height * 0.12);
      }),
    );
    b.box(
      w,
      h,
      0.22,
      b.mat(0xffffff, { map: pcb, roughness: 0.7, metalness: 0.15 }),
      cx,
      cy,
      TRAY_Z - 0.11,
    );

    const heatsink = b.brushed(0x6c727e);
    const dark = b.mat(0x1b1e25, { metalness: 0.75, roughness: 0.35 });
    const plastic = b.mat(0x0c0d11, { roughness: 0.75, metalness: 0.05 });
    const steel = b.brushed(0xd5d9e0);

    // Socket du processeur (visible tant qu'aucun processeur n'est choisi)
    b.box(
      5.2,
      5.2,
      0.35,
      b.mat(0x2b2f37, { metalness: 0.8, roughness: 0.3 }),
      l.cpu.x,
      l.cpu.y,
      TRAY_Z + 0.18,
    );

    // Radiateurs VRM à ailettes autour du socket
    const vrm = (x: number, y: number, vw: number, vh: number) => {
      b.rounded(vw, vh, 1.6, 0.15, heatsink, x, y, TRAY_Z + 0.85);
      const fins = Math.floor(Math.max(vw, vh) / 0.7);
      for (let i = 0; i < fins; i++) {
        const t = -0.5 + (i + 0.5) / fins;
        if (vw > vh) b.box(0.18, vh, 0.6, dark, x + t * vw, y, TRAY_Z + 1.9);
        else b.box(vw, 0.18, 0.6, dark, x, y + t * vh, TRAY_Z + 1.9);
      }
    };
    vrm(l.cpu.x - 5.2, l.cpu.y + 0.4, 2.2, 9);
    vrm(l.cpu.x - 0.3, l.cpu.y + 5.4, 9, 2);

    // Capot E/S arrière avec logo et LED
    b.rounded(3, 10, 3.4, 0.3, dark, x0 + 1.5, BOARD_TOP - 5.8, TRAY_Z + 1.7);
    b.strip(9, 0.25, 0.25, x0 + 3.05, BOARD_TOP - 5.8, TRAY_Z + 3).rotation.z = Math.PI / 2;
    const io = b.label([{ text: part.brand.toUpperCase(), size: 0.75, spacing: 3 }], 8, 1.4);
    io.rotation.z = Math.PI / 2;
    b.add(io, x0 + 1.5, BOARD_TOP - 5.8, TRAY_Z + 3.42);

    // Condensateurs le long des VRM
    const cap = b.mat(0x2a2d33, { metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 6; i++)
      b.cylinder(0.35, 0.9, cap, l.cpu.x - 3.6, l.cpu.y - 3 + i * 1.25, TRAY_Z + 0.45, 'z', 14);

    // Emplacements DIMM avec loquets
    const latch = b.mat(0x3c414c);
    for (let i = 0; i < l.ram.slots; i++) {
      const x = l.ram.x + i * 1.05;
      b.box(0.55, 13.8, 0.8, plastic, x, l.ram.y, TRAY_Z + 0.4);
      b.box(0.6, 0.6, 1.1, latch, x, l.ram.y + 7.1, TRAY_Z + 0.55);
    }

    // Slots PCIe : le premier en acier renforcé
    for (let k = 0; k < 3; k++) {
      const y = l.gpu.top - 0.3 - k * 6.5;
      if (y < y0 + 1) continue;
      const len = Math.min(w - 4, 9);
      b.box(len, 0.65, 0.85, k === 0 ? steel : plastic, x0 + 2.4 + len / 2, y, TRAY_Z + 0.43);
    }

    // Radiateur du chipset avec LED
    b.rounded(4.6, 4.6, 1, 0.3, heatsink, right - 4.4, y0 + 4.6, TRAY_Z + 0.5);
    b.strip(4.2, 0.22, 0.22, right - 4.4, y0 + 7, TRAY_Z + 0.9);

    // Connecteurs : ATX 24 broches, EPS 8 broches, SATA, pile CMOS
    b.box(1.6, 5.6, 1.4, plastic, right - 1, l.cpu.y - 4, TRAY_Z + 0.7);
    b.box(2.4, 1.2, 1.2, plastic, x0 + 3.2, BOARD_TOP - 1, TRAY_Z + 0.6);
    for (let i = 0; i < 4; i++)
      b.box(0.8, 1, 0.7, plastic, right - 0.5, y0 + 9 + i * 1.3, TRAY_Z + 0.35);
    b.cylinder(1, 0.3, steel, right - 8, y0 + 3, TRAY_Z + 0.15, 'z', 24);
  }

  // Processeur + ventirad

  private buildCpu(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const { x, y } = l.cpu;
    // Zone de survol un peu plus large que le ventirad : le processeur reste accessible dessous
    const hit = b.box(
      13,
      14.5,
      1.6,
      b.track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
      x,
      y,
      TRAY_Z + 0.9,
    );
    hit.userData['noShadow'] = true;
    if (!part) {
      b.ghost(5, 5, 1.2, x, y, TRAY_Z + 0.6);
      return;
    }
    // Capot (IHS) gravé du nom du processeur
    b.box(4.4, 4.4, 0.5, b.brushed(0xd9dde4), x, y, TRAY_Z + 0.45);
    const engraving = b.label(
      [
        {
          text: /intel/i.test(part.brand) ? 'INTEL' : 'AMD',
          size: 0.42,
          color: '#3a4152',
          spacing: 2,
        },
        {
          text: part.name.replace(/^(AMD|Intel)\s+/i, '').replace(/\s+Tray$/, ''),
          size: 0.36,
          color: '#3a4152',
        },
      ],
      4,
      2.2,
    );
    b.add(engraving, x, y, TRAY_Z + 0.71);
  }

  // Refroidissement

  private buildCooler(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const { x, y } = l.cpu;
    if (!part) {
      // Cadre fantôme autour du socket : le centre reste au processeur
      b.ghost(11, 2.2, 1.2, x, y + 5.9, TRAY_Z + 1.2);
      b.ghost(11, 2.2, 1.2, x, y - 5.9, TRAY_Z + 1.2);
      b.ghost(2.2, 9.6, 1.2, x - 4.4, y, TRAY_Z + 1.2);
      b.ghost(2.2, 9.6, 1.2, x + 4.4, y, TRAY_Z + 1.2);
      return;
    }
    if (part.cooler?.liquid) this.buildAio(b, part, l);
    else this.buildTower(b, part, l);
  }

  /** Ventirad tour : socle nickelé, caloducs cuivre, 34 ailettes, capot, ventilateur RGB */
  private buildTower(b: Builder, part: ConfiguratorPart, l: Layout) {
    const { x, y } = l.cpu;
    const copper = b.mat(0xc97a4a, { metalness: 0.95, roughness: 0.28 });
    b.rounded(4.6, 4.6, 1.2, 0.15, b.brushed(0xe8ebf0), x, y, TRAY_Z + 1.3);
    const finZ0 = TRAY_Z + 4.4;
    const finZ1 = TRAY_Z + 15.6;
    for (let i = 0; i < 4; i++) {
      b.cylinder(
        0.32,
        finZ1 - TRAY_Z - 1.2,
        copper,
        x - 0.9 + (i % 2) * 1.8,
        y - 2.7 + i * 1.8,
        (TRAY_Z + 1.8 + finZ1) / 2,
        'z',
        14,
      );
    }
    const white = isWhite(part);
    const fin = b.mat(white ? 0xe9ecf1 : 0xc9ced6, { metalness: 0.92, roughness: 0.3 });
    const fins = 34;
    for (let i = 0; i < fins; i++)
      b.box(5, 12, 0.08, fin, x, y, finZ0 + (i / (fins - 1)) * (finZ1 - finZ0 - 0.6));
    b.rounded(
      5.2,
      12.2,
      0.6,
      0.2,
      b.physical(white ? 0xf1f2f5 : 0x15171d, { metalness: 0.6, roughness: 0.35 }),
      x,
      y,
      finZ1,
    );
    b.strip(11.4, 0.22, 0.22, x + 2.62, y, finZ1).rotation.z = Math.PI / 2;
    const cover = b.label(
      [
        {
          text: part.brand.toUpperCase(),
          size: 0.9,
          color: white ? '#3a4152' : '#e8ecf5',
          spacing: 4,
        },
      ],
      10,
      2,
    );
    cover.rotation.z = Math.PI / 2;
    b.add(cover, x - 0.2, y, finZ1 + 0.31);
    b.add(b.fan(12, true), x + 3.85, y, (finZ0 + finZ1) / 2 - 0.4).rotation.y = Math.PI / 2;
  }

  /** Watercooling AIO : pompe sur le processeur, tuyaux gainés, radiateur et ventilateurs en haut du boîtier */
  private buildAio(b: Builder, part: ConfiguratorPart, l: Layout) {
    const { x, y } = l.cpu;
    const white = isWhite(part);
    const shell = b.physical(white ? 0xeef0f4 : 0x15171d, { metalness: 0.5, roughness: 0.35 });

    // Pompe : bloc arrondi, couvercle à anneau RGB, logo
    b.rounded(6.4, 6.4, 2.6, 0.9, shell, x, y, TRAY_Z + 1.6);
    b.cylinder(
      2.7,
      0.5,
      b.mat(0x0b0c10, { roughness: 0.3, metalness: 0.4 }),
      x,
      y,
      TRAY_Z + 3.05,
      'z',
      40,
    );
    const ring = b.add(b.glowMesh(new THREE.TorusGeometry(2.75, 0.2, 10, 48)), x, y, TRAY_Z + 3.3);
    ring.rotation.z = Math.PI / 4;
    const logo = b.label([{ text: part.brand.toUpperCase(), size: 0.55, spacing: 2 }], 4.6, 1);
    b.add(logo, x, y, TRAY_Z + 3.32);

    // Radiateur sous le panneau supérieur (longueur = taille annoncée)
    const length = (l.aioMm ?? 240) / 10 + 3;
    const fans = Math.round(((l.aioMm ?? 240) - 0) / 120);
    const radY = 44.3;
    b.rounded(
      length,
      2.7,
      12.4,
      0.3,
      b.mat(white ? 0xe6e8ed : 0x1a1c22, { metalness: 0.7, roughness: 0.4 }),
      0,
      radY,
      0,
    );
    const finTex = b.mat(white ? 0xcfd3da : 0x2a2d35, { metalness: 0.8, roughness: 0.5 });
    for (let i = 0; i < Math.floor(length / 0.6); i++)
      b.box(0.08, 2.4, 11.6, finTex, -length / 2 + 0.6 + i * 0.6, radY - 0.05, 0);
    const fanSize = 11.6;
    for (let i = 0; i < fans; i++) {
      const fx = -((fans - 1) * fanSize) / 2 + i * fanSize;
      b.add(b.fan(fanSize, true), fx, radY - 2.6, 0).rotation.x = Math.PI / 2;
    }

    // Tuyaux gainés de la pompe vers l'extrémité arrière du radiateur
    const sleeve = b.mat(0x101114, { roughness: 0.75 });
    const endX = -length / 2 + 2.2;
    for (const dz of [-1.4, 1.4]) {
      b.tube(
        [
          new THREE.Vector3(x + 2.6, y + 1.2, TRAY_Z + 2.4 + dz * 0.3),
          new THREE.Vector3(x + 5, y + 4, TRAY_Z + 5),
          new THREE.Vector3(endX + 2, radY - 6, dz * 1.5),
          new THREE.Vector3(endX, radY - 1.4, dz * 2.2),
        ],
        0.55,
        sleeve,
      );
    }
  }

  // Mémoire

  private buildRam(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const modules = part?.ram?.modules ?? 2;
    // 2 barrettes sur 4 emplacements : 2e et 4e, comme le recommandent les fabricants
    const slots =
      modules >= l.ram.slots
        ? [...Array(l.ram.slots).keys()]
        : modules === 1
          ? [Math.min(1, l.ram.slots - 1)]
          : l.ram.slots >= 4
            ? [1, 3]
            : [0, 1];

    const white = isWhite(part);
    for (const i of slots) {
      const x = l.ram.x + i * 1.05;
      if (!part) {
        b.ghost(0.6, 13.3, 4, x, l.ram.y, TRAY_Z + 2.4);
        continue;
      }
      // Dissipateur à profil biseauté (extrudé sur la longueur de la barrette)
      const profile = new THREE.Shape();
      profile.moveTo(-0.32, 0);
      profile.lineTo(0.32, 0);
      profile.lineTo(0.32, 3.1);
      profile.lineTo(0.16, 3.5);
      profile.lineTo(-0.16, 3.5);
      profile.lineTo(-0.32, 3.1);
      profile.closePath();
      const geo = b.track(new THREE.ExtrudeGeometry(profile, { depth: 13.3, bevelEnabled: false }));
      geo.translate(0, 0, -13.3 / 2);
      geo.rotateX(Math.PI / 2); // hauteur du profil → vers la vitre (z), longueur → verticale (y)
      b.add(
        new THREE.Mesh(
          geo,
          b.physical(white ? 0xe6e8ed : 0x1e2128, { metalness: 0.8, roughness: 0.3 }),
        ),
        x,
        l.ram.y,
        TRAY_Z + 0.9,
      );
      b.box(0.5, 13.1, 0.5, b.mat(0x1d5b3a, { roughness: 0.6 }), x, l.ram.y, TRAY_Z + 0.75);
      b.strip(13.1, 0.3, 0.55, x, l.ram.y, TRAY_Z + 4.6).rotation.z = Math.PI / 2;
      const brand = b.label(
        [
          {
            text: part.brand.toUpperCase(),
            size: 0.42,
            spacing: 2,
            color: white ? '#5a6070' : '#c8cfdc',
          },
        ],
        6,
        0.5,
      );
      brand.rotation.set(0, Math.PI / 2, Math.PI / 2);
      b.add(brand, x + 0.33, l.ram.y - 2, TRAY_Z + 2.6);
    }
  }

  // Carte graphique

  private buildGpu(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const { length, top } = l.gpu;
    const depth = 12;
    const thick = 4.6;
    const x = GPU_BRACKET_X + length / 2;
    const y = top - thick / 2;
    const z = TRAY_Z + depth / 2 + 0.4;
    if (!part) {
      b.ghost(length, thick, depth, x, y, z);
      return;
    }
    const white = isWhite(part);

    // Carénage vernis, radiateur visible, plaque arrière gravée
    b.rounded(
      length,
      thick - 1.2,
      depth,
      0.45,
      b.physical(white ? 0xe8eaef : 0x1b1e25, { metalness: 0.5, roughness: 0.32 }),
      x,
      y - 0.4,
      z,
    );
    b.box(
      length - 1.2,
      0.6,
      depth - 0.8,
      b.mat(0xb8bec8, { metalness: 0.9, roughness: 0.35 }),
      x,
      y + thick / 2 - 0.95,
      z,
    );
    const backplate = b.track(
      canvasTexture(512, 192, (ctx) => {
        ctx.fillStyle = white ? '#e3e6ec' : '#2a2e37';
        ctx.fillRect(0, 0, 512, 192);
        ctx.fillStyle = white ? '#c9cdd5' : '#1a1d24';
        for (let i = 0; i < 14; i++)
          ctx.fillRect(330 + (i % 7) * 22, 40 + Math.floor(i / 7) * 70, 10, 50);
        ctx.fillStyle = white ? '#8a909c' : '#9aa3b5';
        ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(part.brand.toUpperCase(), 40, 110);
      }),
    );
    b.rounded(
      length,
      0.4,
      depth,
      0.15,
      b.mat(0xffffff, { map: backplate, metalness: 0.8, roughness: 0.35 }),
      x,
      y + thick / 2 - 0.25,
      z,
    );

    // Équerre avec sorties vidéo
    b.box(0.25, thick + 2, depth + 0.4, b.brushed(0xc0c5ce), GPU_BRACKET_X - 0.15, y, z);
    const port = b.mat(0x0c0d11);
    for (let i = 0; i < 4; i++)
      b.box(0.3, 0.9, 1.8, port, GPU_BRACKET_X - 0.3, y - 1, z - 4 + i * 2.4);

    // Connecteur d'alimentation sur la tranche supérieure
    b.box(
      2.4,
      0.9,
      1.4,
      b.mat(0x0c0d11),
      GPU_BRACKET_X + length * 0.72,
      top + 0.1,
      z + depth / 2 - 1.4,
    );

    // Bandeau RGB + nom de la puce sur la tranche visible
    b.strip(length - 3, 0.28, 0.25, x + 0.6, y + thick / 2 - 1.4, z + depth / 2 + 0.06);
    const chip = (part.gpu?.chipset ?? '').replace(/^(GeForce|Radeon)\s+/i, '').toUpperCase();
    const label = b.label(
      [
        { text: chip, size: 1.05, color: white ? '#1b1f29' : '#f1f4fb' },
        {
          text: `${part.brand.toUpperCase()} · ${part.gpu?.vramGB ?? ''} GB`,
          size: 0.55,
          color: white ? '#4b5263' : '#9aa3b5',
          weight: 600,
          spacing: 2,
        },
      ],
      Math.min(16, length - 4),
      2.5,
    );
    b.add(label, x + 0.8, y - 1.15, z + depth / 2 + 0.05);

    // Ventilateurs RGB sous la carte
    const fans = length > 26 ? 3 : 2;
    const fanSize = Math.min(9.6, (length - 1) / fans - 0.4);
    for (let i = 0; i < fans; i++) {
      const fan = b.add(
        b.fan(fanSize, true, false),
        GPU_BRACKET_X + 0.6 + ((length - 1) / fans) * (i + 0.5),
        y - thick / 2 + 0.6,
        z,
      );
      fan.rotation.x = Math.PI / 2;
    }
  }

  // Stockage

  private buildStorage(b: Builder, part: ConfiguratorPart | null, l: Layout) {
    const sata = !!part && part.highlights.some((h) => h.includes('2.5'));
    if (sata) {
      // SSD 2,5" posé sur le cache-alimentation, côté façade
      const y = l.floorY + 0.4;
      b.rounded(10, 0.7, 7, 0.2, b.brushed(0x8d939e), 12, y, 2);
      const label = b.label(
        [
          { text: part!.brand.toUpperCase(), size: 0.85, spacing: 2 },
          { text: 'SSD', size: 0.5, color: '#9aa3b5' },
        ],
        6,
        3,
      );
      label.rotation.x = -Math.PI / 2;
      b.add(label, 12, y + 0.37, 2);
      return;
    }
    const { x, y } = l.m2;
    // Cible de survol élargie : la barrette M.2 est très fine
    const hit = b.box(
      9,
      3.4,
      2.4,
      b.track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })),
      x,
      y,
      TRAY_Z + 1.2,
    );
    hit.userData['noShadow'] = true;
    if (!part) {
      b.ghost(8, 2.2, 0.8, x, y, TRAY_Z + 0.4);
      return;
    }
    b.box(8, 2.2, 0.2, b.mat(0x1a5c3a, { roughness: 0.6 }), x, y, TRAY_Z + 0.12);
    b.rounded(7.2, 2.3, 0.7, 0.12, b.brushed(0x4a505c), x + 0.3, y, TRAY_Z + 0.6);
    const groove = b.mat(0x2a2e36);
    for (let i = 0; i < 8; i++)
      b.box(0.12, 2.3, 0.25, groove, x - 2.8 + i * 0.85, y, TRAY_Z + 1.05);
    b.strip(7, 0.18, 0.2, x + 0.3, y + 1.15, TRAY_Z + 0.9);
  }

  // Alimentation + câbles

  private buildPsu(b: Builder, part: ConfiguratorPart | null, sel: Selection, l: Layout) {
    const [x, z] = [-13, -2.3];
    if (!part) {
      b.ghost(16, 8.6, 14, x, 5.1, z);
      return;
    }
    const sfx = part.psu?.formFactor === 'SFX';
    const [w, h, d] = sfx ? [12.5, 6.4, 10] : [16, 8.6, 14];
    const y = 0.8 + h / 2;
    b.rounded(
      w,
      h,
      d,
      0.4,
      b.physical(0x16181e, { metalness: 0.65, roughness: 0.42, clearcoat: 0.2 }),
      x,
      y,
      z,
    );

    // Plaque signalétique visible par la fenêtre du cache (couleur de la certification 80+)
    const efficiency = part.psu?.efficiency ?? '';
    const badge = /titanium|platinum|silver/i.test(efficiency)
      ? '#c9ccd3'
      : /gold/i.test(efficiency)
        ? '#e1b04a'
        : /bronze/i.test(efficiency)
          ? '#c48a55'
          : '#9aa3b5';
    const label = b.label(
      [
        { text: part.brand.toUpperCase(), size: 0.62, color: '#9aa3b5', spacing: 3 },
        { text: `${part.psu?.wattage ?? ''} W`, size: 1.9 },
        { text: efficiency.toUpperCase(), size: 0.6, color: badge, weight: 700 },
      ],
      w - 2,
      h - 1.6,
    );
    b.add(label, x, y, z + d / 2 + 0.03);
    b.strip(w - 1.5, 0.22, 0.2, x, 0.8 + h - 0.55, z + d / 2 + 0.05);

    // Câbles gainés vers la carte mère et la carte graphique (sortent des passe-câbles)
    const sleeve = b.track(this.tex.braid.clone());
    sleeve.repeat.set(30, 1);
    sleeve.needsUpdate = true;
    const cable = b.mat(0xffffff, { map: sleeve, roughness: 0.8, metalness: 0.05 });
    const gx = l.board.right + 2.4;
    const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);

    if (sel.motherboard) {
      // ATX 24 broches
      const cy = l.cpu.y - 4;
      b.tube(
        [
          v(gx, cy - 3, -10.6),
          v(gx, cy - 2, -8.4),
          v(gx - 1.2, cy - 0.5, -7.6),
          v(l.board.right - 0.2, cy, -7.9),
        ],
        0.75,
        cable,
      );
      // EPS 8 broches du processeur
      b.tube(
        [
          v(l.board.x0 + 4, 45.6, -10.6),
          v(l.board.x0 + 4, 45.4, -8.6),
          v(l.board.x0 + 3.4, 44.2, -8.1),
          v(l.board.x0 + 3.2, BOARD_TOP - 0.6, -8.5),
        ],
        0.45,
        cable,
      );
    }
    if (sel.gpu) {
      // PCIe / 12V-2x6 de la carte graphique
      const column = Math.min(18.5, Math.max(l.gpu.end, l.board.right) + 2.4);
      const conX = GPU_BRACKET_X + l.gpu.length * 0.72;
      const conZ = TRAY_Z + 12 + 0.4 - 1.4;
      b.tube(
        [
          v(column, l.gpu.top + 5, -10.6),
          v(column, l.gpu.top + 4.5, -7),
          v(conX + 2, l.gpu.top + 3.6, conZ - 1),
          v(conX, l.gpu.top + 1.6, conZ),
          v(conX, l.gpu.top + 0.5, conZ),
        ],
        0.55,
        cable,
      );
    }
  }
}
