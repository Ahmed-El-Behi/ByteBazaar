import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { PC_SLOTS, type Slot } from '../core/configurator-api';
import { DESK_TARGET } from './desk-model';
import { Icon } from './icon';
import { ProductNamePipe, TPipe } from '../core/i18n';
import { PcModel, type HoverTarget, type SceneMode, type Selection } from './pc-model';

/** Cadrage de chaque vue : point visé, position de départ et limites de la caméra */
const VIEWS: Record<
  SceneMode,
  {
    target: THREE.Vector3;
    radius: number;
    polar: number;
    azimuth: number;
    distance: [number, number];
    azimuthRange: [number, number];
    polarRange: [number, number];
    sway: [number, number];
  }
> = {
  desk: {
    target: DESK_TARGET,
    radius: 290,
    polar: 1.2,
    azimuth: 0,
    distance: [170, 370],
    azimuthRange: [-0.75, 0.75],
    polarRange: [Math.PI * 0.26, Math.PI * 0.49],
    sway: [-0.28, 0.32],
  },
  pc: {
    target: new THREE.Vector3(0, 22, 0),
    radius: 92,
    polar: 1.24,
    azimuth: 0.3,
    distance: [55, 125],
    azimuthRange: [-1.2, 1.2],
    polarRange: [Math.PI * 0.22, Math.PI * 0.56],
    sway: [-0.15, 0.75],
  },
};
const IDLE_MS = 5000;
const QUALITY_KEY = 'bytebazaar_configurator_quality';

function readLowGraphics() {
  try {
    return localStorage.getItem(QUALITY_KEY) === 'low';
  } catch {
    return false;
  }
}
const ZOOM_SECONDS = 1.1;

/**
 * Configurateur 3D à deux niveaux :
 *  - vue d'ensemble : le poste complet (PC, écran, clavier, souris, casque). Le PC se survole
 *    comme un tout ; un clic dessus zoome à l'intérieur. Les périphériques se choisissent ici ;
 *  - intérieur du PC : chaque pièce s'illumine au survol et se choisit d'un clic.
 */
@Component({
  imports: [Icon, TPipe, ProductNamePipe],
  selector: 'app-pc-scene',
  template: `
    <div class="scene" #host>
      <canvas
        #canvas
        role="img"
        [attr.aria-label]="
          'Vue 3D du poste : cliquez sur le PC pour en choisir les pièces, ou sur un périphérique pour le choisir. La liste des emplacements sous la vue offre les mêmes actions au clavier.'
            | t
        "
        (pointermove)="onPointerMove($event)"
        (pointerleave)="onPointerLeave()"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      ></canvas>

      @if (webglFailed()) {
        <div class="fallback">
          {{
            "La vue 3D n'est pas disponible sur cet appareil : utilisez la liste des emplacements ci-dessous."
              | t
          }}
        </div>
      }

      <div class="tip" #tip [hidden]="!tipTarget()">
        @if (tipTarget() === 'pc') {
          <span class="tip-slot">{{ 'Votre PC' | t }}</span>
          <strong class="tip-name">{{
            '{count} / {total} pièces choisies'
              | t: { count: pcSummary().count, total: pcSlotCount }
          }}</strong>
          @if (pcSummary().total > 0) {
            <span class="tip-meta">{{ pcSummary().total }} TND</span>
          }
          <span class="tip-hint">{{ 'Cliquer pour ouvrir le PC et choisir ses pièces' | t }}</span>
        } @else if (tipSlot(); as slot) {
          <span class="tip-slot">{{ labels()[slot] | t }}</span>
          @if (selection()[slot]; as part) {
            <strong class="tip-name">{{ part.name | productName }}</strong>
            <span class="tip-meta">{{ part.price }} TND · {{ part.highlights.join(' · ') }}</span>
            <span class="tip-hint">{{ 'Cliquer pour changer' | t }}</span>
          } @else {
            <strong class="tip-name">{{ 'Emplacement libre' | t }}</strong>
            <span class="tip-hint">{{ 'Cliquer pour choisir' | t }}</span>
          }
        }
      </div>

      @if (mode() === 'pc') {
        <button
          type="button"
          class="back"
          (click)="setMode('desk')"
          [title]="'Revenir au poste complet (Échap)' | t"
        >
          <app-icon name="arrowLeft" [size]="16" [stroke]="2" /> {{ "Vue d'ensemble" | t }}
        </button>
      }

      <div class="hud">
        <span class="hint">
          @if (mode() === 'desk') {
            {{
              'Cliquez sur le PC pour choisir ses pièces · survolez un périphérique pour le choisir · glissez pour tourner'
                | t
            }}
          } @else {
            {{
              'Survolez une pièce · cliquez pour la choisir · glissez pour tourner · Échap pour revenir'
                | t
            }}
          }
        </span>
        <button
          type="button"
          class="quality"
          [class.on]="lowGraphics()"
          (click)="toggleLowGraphics()"
          [attr.aria-pressed]="lowGraphics()"
          [title]="
            (lowGraphics()
              ? 'Réactiver les effets (RGB, ventilateurs, ombres)'
              : 'Mode performance : couper le RGB, les animations et les effets'
            ) | t
          "
        >
          <app-icon [name]="lowGraphics() ? 'sparkles' : 'gauge'" [size]="15" />
          {{ (lowGraphics() ? 'Effets' : 'Performance') | t }}
        </button>
        <button
          type="button"
          class="reset-view"
          (click)="resetView()"
          [title]="'Recentrer la vue' | t"
          [attr.aria-label]="'Recentrer la vue' | t"
        >
          <app-icon name="reset" [size]="16" />
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .scene {
      position: relative;
      height: 600px;
      border-radius: var(--r-xl);
      overflow: hidden;
      border: 1px solid var(--border, #1e293b);
      background: var(--surface-2, #131927);
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      outline: none;
    }
    canvas.pointing {
      cursor: pointer;
    }
    .fallback {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2rem;
      text-align: center;
      color: var(--muted, #94a3b8);
    }
    .tip {
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      max-width: 270px;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      padding: 0.7rem 0.9rem;
      border-radius: var(--r-md);
      border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
      background: color-mix(in srgb, var(--surface, #0d1117) 92%, transparent);
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
      transform: translate(-50%, calc(-100% - 14px));
      will-change: left, top;
    }
    .tip-slot {
      font-size: var(--fs-2xs);
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .tip-name {
      font-size: var(--fs-md);
      line-height: 1.3;
      color: var(--text, #fff);
    }
    .tip-meta {
      font-size: var(--fs-xs);
      color: var(--muted, #94a3b8);
    }
    .tip-hint {
      font-size: var(--fs-xs);
      font-weight: 600;
      color: var(--accent);
      margin-top: 0.15rem;
    }
    .back {
      position: absolute;
      top: 1rem;
      left: 1rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.9rem;
      border-radius: 999px;
      border: 1px solid var(--border, #1e293b);
      background: color-mix(in srgb, var(--surface, #0d1117) 88%, transparent);
      backdrop-filter: blur(8px);
      color: var(--text, #fff);
      font-size: var(--fs-sm);
      font-weight: 700;
      box-shadow: var(--shadow-sm);
    }
    .back:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .hud {
      position: absolute;
      left: 1rem;
      right: 1rem;
      bottom: 0.9rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      pointer-events: none;
    }
    .hint {
      font-size: var(--fs-xs);
      color: var(--muted, #94a3b8);
      background: color-mix(in srgb, var(--surface, #0d1117) 75%, transparent);
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
    }
    .reset-view {
      pointer-events: auto;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid var(--border, #1e293b);
      background: var(--surface, #0d1117);
      color: var(--text, #fff);
    }
    .reset-view:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .quality {
      pointer-events: auto;
      margin-left: auto;
      flex-shrink: 0;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      height: 34px;
      padding: 0 0.8rem;
      border-radius: 999px;
      border: 1px solid var(--border, #1e293b);
      background: var(--surface, #0d1117);
      color: var(--text, #fff);
      font-size: var(--fs-xs);
      font-weight: 700;
    }
    .quality:hover,
    .quality.on {
      border-color: var(--accent);
      color: var(--accent);
    }
    @media (max-width: 700px) {
      .scene {
        height: 440px;
      }
      .hint {
        display: none;
      }
    }
  `,
})
export class PcScene {
  readonly selection = input.required<Selection>();
  readonly labels = input.required<Record<Slot, string>>();
  /** Emplacement survolé depuis l'extérieur (liste des emplacements) */
  readonly highlighted = input<Slot | null>(null);

  readonly pick = output<Slot>();
  readonly hoverChange = output<Slot | null>();

  readonly webglFailed = signal(false);
  readonly mode = signal<SceneMode>('desk');
  /** Mode performance : graphismes allégés (choix mémorisé dans le navigateur) */
  readonly lowGraphics = signal(readLowGraphics());
  private applyQuality?: (low: boolean) => void;
  private readonly pointerTarget = signal<HoverTarget | null>(null);
  private readonly transitioning = signal(false);

  readonly pcSlotCount = PC_SLOTS.length;
  readonly pcSummary = computed(() => {
    const parts = PC_SLOTS.map((slot) => this.selection()[slot]).filter((p) => !!p);
    return { count: parts.length, total: Math.round(parts.reduce((sum, p) => sum + p!.price, 0)) };
  });

  /** Élément mis en avant : survol à la souris, sinon survol d'un emplacement dans la liste */
  readonly tipTarget = computed<HoverTarget | null>(() => {
    if (this.transitioning()) return null;
    const pointer = this.pointerTarget();
    if (pointer) return pointer;
    const outside = this.highlighted();
    if (!outside) return null;
    const isPcPart = (PC_SLOTS as Slot[]).includes(outside);
    if (this.mode() === 'desk') return isPcPart ? 'pc' : outside;
    return isPcPart ? outside : null;
  });

  /** Pièce mise en avant (hors « PC entier ») */
  readonly tipSlot = computed<Slot | null>(() => {
    const target = this.tipTarget();
    return target && target !== 'pc' ? target : null;
  });

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly tip = viewChild.required<ElementRef<HTMLDivElement>>('tip');

  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private model?: PcModel;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private lastInteraction = 0;
  private swayDirection = 1;
  private reducedMotion = false;
  /** Zoom en cours entre les deux vues */
  private flight: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
  } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const cleanup = this.init();
      destroyRef.onDestroy(cleanup);
    });

    // Sélection modifiée → pièces reconstruites (avec animation d'installation).
    // La première construction a lieu dans init(), sans animation.
    effect(() => {
      const selection = this.selection();
      this.model?.setSelection(selection, true);
    });

    effect(() => this.model?.setHover(this.tipTarget()));
  }

  /** Passe de la vue d'ensemble à l'intérieur du PC (et inversement), avec un zoom animé. */
  setMode(mode: SceneMode) {
    if (mode === this.mode() && !this.flight) return;
    this.mode.set(mode);
    this.setPointerTarget(null);
    this.flyTo(mode);
  }

  toggleLowGraphics() {
    const low = !this.lowGraphics();
    this.lowGraphics.set(low);
    try {
      localStorage.setItem(QUALITY_KEY, low ? 'low' : 'high');
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    this.applyQuality?.(low);
  }

  resetView() {
    this.flyTo(this.mode());
  }

  // Pointeur

  onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch' || this.flight) return;
    this.setPointerTarget(this.targetAt(event));
  }

  onPointerLeave() {
    this.setPointerTarget(null);
  }

  onPointerDown(event: PointerEvent) {
    this.downAt = { x: event.clientX, y: event.clientY };
  }

  onPointerUp(event: PointerEvent) {
    const start = this.downAt;
    this.downAt = null;
    // Un glisser fait tourner la vue : seul un vrai clic agit
    if (!start || this.flight || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6)
      return;
    const target = this.targetAt(event);
    if (target === 'pc') this.setMode('pc');
    else if (target) this.pick.emit(target);
  }

  private setPointerTarget(target: HoverTarget | null) {
    if (target === this.pointerTarget()) return;
    this.pointerTarget.set(target);
    this.hoverChange.emit(target === 'pc' ? null : target);
    this.canvas().nativeElement.classList.toggle('pointing', !!target);
    if (target) this.lastInteraction = performance.now();
  }

  private targetAt(event: PointerEvent): HoverTarget | null {
    if (!this.camera || !this.model) return null;
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const mode = this.mode();
    for (const hit of this.raycaster.intersectObjects(this.model.hitTargets(mode), true)) {
      const target = this.model.slotOf(hit.object, mode);
      if (target) return target;
    }
    return null;
  }

  // Caméra

  private flyTo(mode: SceneMode) {
    if (!this.camera || !this.controls) return;
    const view = VIEWS[mode];
    const toPos = new THREE.Vector3()
      .setFromSpherical(new THREE.Spherical(view.radius, view.polar, view.azimuth))
      .add(view.target);
    this.flight = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget: view.target.clone(),
      t: this.reducedMotion ? 1 : 0,
    };
    // Limites relâchées pendant le vol, appliquées à l'arrivée
    Object.assign(this.controls, {
      enabled: false,
      minDistance: 0,
      maxDistance: Infinity,
      minAzimuthAngle: -Infinity,
      maxAzimuthAngle: Infinity,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
    });
    this.transitioning.set(true);
    this.lastInteraction = performance.now();
  }

  private stepFlight(dt: number) {
    const flight = this.flight;
    if (!flight || !this.camera || !this.controls) return;
    flight.t = Math.min(1, flight.t + dt / ZOOM_SECONDS);
    // Accélération puis décélération douces
    const k = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - (-2 * flight.t + 2) ** 3 / 2;
    this.camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
    this.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
    if (flight.t >= 1) {
      const view = VIEWS[this.mode()];
      Object.assign(this.controls, {
        enabled: true,
        minDistance: view.distance[0],
        maxDistance: view.distance[1],
        minAzimuthAngle: view.azimuthRange[0],
        maxAzimuthAngle: view.azimuthRange[1],
        minPolarAngle: view.polarRange[0],
        maxPolarAngle: view.polarRange[1],
      });
      this.flight = null;
      this.transitioning.set(false);
    }
  }

  // Scène

  private init(): () => void {
    const canvas = this.canvas().nativeElement;
    const host = this.host().nativeElement;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      this.webglFailed.set(true);
      return () => undefined;
    }
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = (this.camera = new THREE.PerspectiveCamera(32, 1, 1, 1200));

    // Environnement de studio : reflets réalistes sur le métal, le verre et le vernis
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.4;

    // Fond dégradé aux couleurs du thème (rendu opaque, nécessaire au bloom)
    let background: THREE.Texture | null = null;
    const paintBackground = () => {
      const styles = getComputedStyle(document.documentElement);
      const base = styles.getPropertyValue('--surface-2').trim() || '#131927';
      const hex = new THREE.Color(this.readAccent()).getHex();
      background?.dispose();
      const canvas2d = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
      const ctx = canvas2d.getContext('2d')!;
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 512, 512);
      const halo = ctx.createRadialGradient(256, 200, 10, 256, 220, 360);
      halo.addColorStop(0, `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, 0.22)`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, 512, 512);
      const vignette = ctx.createRadialGradient(256, 256, 180, 256, 256, 380);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);
      background = new THREE.CanvasTexture(canvas2d);
      background.colorSpace = THREE.SRGBColorSpace;
      scene.background = background;
    };
    paintBackground();

    scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2f3c, 0.9));
    // Lumière principale : ombres douces sur tout le bureau et à l'intérieur du boîtier
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(30, 150, 140);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.05;
    Object.assign(key.shadow.camera, {
      left: -160,
      right: 160,
      top: 120,
      bottom: -120,
      near: 20,
      far: 480,
    });
    key.target.position.set(-70, 10, 0);
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0x9db4ff, 1.1);
    fill.position.set(-180, 60, 90);
    scene.add(fill);
    // Lumière dans l'axe de la vitre : éclaire l'intérieur du boîtier
    const inner = new THREE.DirectionalLight(0xffffff, 0.9);
    inner.position.set(5, 25, 80);
    scene.add(inner);

    // Post-traitement : halo lumineux (bloom) sur les LED RGB uniquement (seuil élevé)
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.addPass(new RenderPass(scene, camera));
    // Seuil > 1 (HDR) : seules les LED (émission ≥ 3) dépassent, pas les surfaces blanches éclairées
    const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.8, 0.45, 1.6);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const model = new PcModel(this.readAccent());
    model.setSelection(this.selection(), false);
    model.setHover(this.tipTarget());
    scene.add(model.root);
    this.model = model;

    // Mode performance : ni halo (bloom), ni ombres, résolution 1x, LED et ventilateurs à l'arrêt
    let low = false;
    this.applyQuality = (on: boolean) => {
      low = on;
      model.setLowGraphics(on);
      key.castShadow = !on;
      const ratio = on ? 1 : pixelRatio;
      renderer.setPixelRatio(ratio);
      composer.setPixelRatio(ratio);
      resize();
    };

    const controls = (this.controls = new OrbitControls(camera, canvas));
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.addEventListener('start', () => (this.lastInteraction = performance.now()));
    // Position initiale : directement en vue d'ensemble
    const start = VIEWS.desk;
    controls.target.copy(start.target);
    camera.position
      .setFromSpherical(new THREE.Spherical(start.radius, start.polar, start.azimuth))
      .add(start.target);
    this.flight = {
      fromPos: camera.position.clone(),
      toPos: camera.position.clone(),
      fromTarget: start.target.clone(),
      toTarget: start.target.clone(),
      t: 1,
    };
    this.stepFlight(0);
    this.lastInteraction = 0;

    // Taille du canvas = taille du conteneur
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      // Recul automatique sur les écrans étroits pour garder la scène entière
      camera.zoom = Math.min(1, w / h / 1.15);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    this.applyQuality(this.lowGraphics());

    // Couleur d'accent du thème (claire / sombre)
    const themeObserver = new MutationObserver(() => {
      model.setAccent(this.readAccent());
      paintBackground();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Échap : retour à la vue d'ensemble
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.mode() === 'pc') this.setMode('desk');
    };
    window.addEventListener('keydown', onKey);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = motionQuery.matches;
    const onMotion = (e: MediaQueryListEvent) => (this.reducedMotion = e.matches);
    motionQuery.addEventListener('change', onMotion);

    const anchor = new THREE.Vector3();
    let previous = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;

      if (this.flight) this.stepFlight(dt);
      // Balancement lent de la caméra quand personne n'interagit
      else if (
        !low &&
        !this.reducedMotion &&
        !this.tipTarget() &&
        now - this.lastInteraction > IDLE_MS
      ) {
        const [min, max] = VIEWS[this.mode()].sway;
        const spherical = new THREE.Spherical().setFromVector3(
          camera.position.clone().sub(controls.target),
        );
        if (spherical.theta > max) this.swayDirection = -1;
        if (spherical.theta < min) this.swayDirection = 1;
        spherical.theta += this.swayDirection * dt * 0.06;
        camera.position.setFromSpherical(spherical).add(controls.target);
      }

      controls.update();
      model.update(dt, now / 1000, this.reducedMotion);
      if (low) renderer.render(scene, camera);
      else composer.render();

      // Info-bulle accrochée au-dessus de l'élément survolé
      const target = this.tipTarget();
      if (target) {
        model.anchorOf(target, anchor).project(camera);
        const tip = this.tip().nativeElement;
        const x = Math.min(
          Math.max((anchor.x * 0.5 + 0.5) * host.clientWidth, 140),
          host.clientWidth - 140,
        );
        const y = Math.max((-anchor.y * 0.5 + 0.5) * host.clientHeight, 110);
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      }
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('keydown', onKey);
      motionQuery.removeEventListener('change', onMotion);
      controls.dispose();
      model.dispose();
      composer.dispose();
      bloom.dispose();
      environment.dispose();
      pmrem.dispose();
      background?.dispose();
      renderer.dispose();
      this.model = undefined;
      this.applyQuality = undefined;
    };
  }

  private readAccent(): string {
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f59e0b'
    );
  }
}
