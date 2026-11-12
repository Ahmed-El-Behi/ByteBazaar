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
import type { Slot } from '../core/configurator-api';
import { PcModel, type Selection } from './pc-model';

const TARGET = new THREE.Vector3(0, 22, 0);
const HOME = { radius: 92, polar: 1.24, azimuth: 0.3 };
const IDLE_MS = 5000;

/**
 * PC ouvert en 3D : survoler une pièce l'illumine et affiche ce qui est installé,
 * cliquer dessus émet `pick` (le parent ouvre alors le sélecteur de composants).
 */
@Component({
  selector: 'app-pc-scene',
  template: `
    <div class="scene" #host>
      <canvas
        #canvas
        role="img"
        aria-label="Vue 3D du PC : survolez une pièce puis cliquez pour la choisir. La liste des emplacements sous la vue offre les mêmes actions au clavier."
        (pointermove)="onPointerMove($event)"
        (pointerleave)="onPointerLeave()"
        (pointerdown)="onPointerDown($event)"
        (pointerup)="onPointerUp($event)"
      ></canvas>

      @if (webglFailed()) {
        <div class="fallback">La vue 3D n'est pas disponible sur cet appareil : utilisez la liste des emplacements ci-dessous.</div>
      }

      <div class="tip" #tip [hidden]="!tipSlot()">
        @if (tipSlot(); as slot) {
          <span class="tip-slot">{{ labels()[slot] }}</span>
          @if (selection()[slot]; as part) {
            <strong class="tip-name">{{ part.name }}</strong>
            <span class="tip-meta">{{ part.price }} TND · {{ part.highlights.join(' · ') }}</span>
            <span class="tip-hint">Cliquer pour changer</span>
          } @else {
            <strong class="tip-name">Emplacement libre</strong>
            <span class="tip-hint">Cliquer pour choisir</span>
          }
        }
      </div>

      <div class="hud">
        <span class="hint">Survolez une pièce · cliquez pour la choisir · glissez pour tourner · molette pour zoomer</span>
        <button type="button" class="reset-view" (click)="resetView()" title="Recentrer la vue" aria-label="Recentrer la vue">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .scene {
      position: relative; height: 600px; border-radius: 24px; overflow: hidden;
      border: 1px solid var(--border, #1e293b);
      background:
        radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--accent, #f59e0b) 14%, transparent), transparent 65%),
        var(--surface-2, #131927);
    }
    canvas { display: block; width: 100%; height: 100%; touch-action: none; outline: none; }
    canvas.pointing { cursor: pointer; }
    .fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 2rem; text-align: center; color: var(--muted, #94a3b8); }
    .tip {
      position: absolute; left: 0; top: 0; pointer-events: none; max-width: 270px;
      display: flex; flex-direction: column; gap: 0.2rem; padding: 0.7rem 0.9rem;
      border-radius: 14px; border: 1px solid color-mix(in srgb, var(--accent, #f59e0b) 55%, transparent);
      background: color-mix(in srgb, var(--surface, #0d1117) 92%, transparent);
      backdrop-filter: blur(8px); box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
      transform: translate(-50%, calc(-100% - 14px)); will-change: left, top;
    }
    .tip-slot { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent, #f59e0b); }
    .tip-name { font-size: 0.9rem; line-height: 1.3; color: var(--text, #fff); }
    .tip-meta { font-size: 0.75rem; color: var(--muted, #94a3b8); }
    .tip-hint { font-size: 0.72rem; font-weight: 600; color: var(--accent, #f59e0b); margin-top: 0.15rem; }
    .hud { position: absolute; left: 1rem; right: 1rem; bottom: 0.9rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; pointer-events: none; }
    .hint { font-size: 0.75rem; color: var(--muted, #94a3b8); background: color-mix(in srgb, var(--surface, #0d1117) 75%, transparent); padding: 0.35rem 0.75rem; border-radius: 999px; }
    .reset-view {
      pointer-events: auto; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
      border: 1px solid var(--border, #1e293b); background: var(--surface, #0d1117); color: var(--text, #fff); cursor: pointer;
    }
    .reset-view:hover { border-color: var(--accent, #f59e0b); color: var(--accent, #f59e0b); }
    @media (max-width: 700px) { .scene { height: 420px; } .hint { display: none; } }
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
  private readonly pointerSlot = signal<Slot | null>(null);
  readonly tipSlot = computed(() => this.pointerSlot() ?? this.highlighted());

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly tip = viewChild.required<ElementRef<HTMLDivElement>>('tip');

  private renderer?: THREE.WebGLRenderer;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private model?: PcModel;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private lastInteraction = 0;
  private swayDirection = 1;
  private reducedMotion = false;

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

    effect(() => this.model?.setHover(this.tipSlot()));
  }

  resetView() {
    if (!this.camera || !this.controls) return;
    this.camera.position.setFromSpherical(new THREE.Spherical(HOME.radius, HOME.polar, HOME.azimuth)).add(TARGET);
    this.controls.update();
    this.lastInteraction = performance.now();
  }

  // --------------------------------------------------------------- Pointeur

  onPointerMove(event: PointerEvent) {
    if (event.pointerType === 'touch') return;
    this.setPointerSlot(this.slotAt(event));
  }

  onPointerLeave() {
    this.setPointerSlot(null);
  }

  onPointerDown(event: PointerEvent) {
    this.downAt = { x: event.clientX, y: event.clientY };
  }

  onPointerUp(event: PointerEvent) {
    const start = this.downAt;
    this.downAt = null;
    // Un glisser fait tourner la vue : seul un vrai clic choisit la pièce
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const slot = this.slotAt(event);
    if (slot) this.pick.emit(slot);
  }

  private setPointerSlot(slot: Slot | null) {
    if (slot === this.pointerSlot()) return;
    this.pointerSlot.set(slot);
    this.hoverChange.emit(slot);
    this.canvas().nativeElement.classList.toggle('pointing', !!slot);
    if (slot) this.lastInteraction = performance.now();
  }

  private slotAt(event: PointerEvent): Slot | null {
    if (!this.camera || !this.model) return null;
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects(this.model.hitTargets(), true)) {
      const slot = this.model.slotOf(hit.object);
      if (slot) return slot;
    }
    return null;
  }

  // --------------------------------------------------------------- Scène

  private init(): () => void {
    const canvas = this.canvas().nativeElement;
    const host = this.host().nativeElement;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      this.webglFailed.set(true);
      return () => undefined;
    }
    const renderer = this.renderer;
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    const camera = (this.camera = new THREE.PerspectiveCamera(32, 1, 1, 500));

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
      const glow = this.readAccent();
      background?.dispose();
      background = new THREE.CanvasTexture(
        Object.assign(document.createElement('canvas'), { width: 512, height: 512 }),
      );
      const ctx = (background.image as HTMLCanvasElement).getContext('2d')!;
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 512, 512);
      const halo = ctx.createRadialGradient(256, 200, 10, 256, 220, 360);
      const hex = new THREE.Color(glow).getHex();
      halo.addColorStop(0, `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, 0.22)`);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, 512, 512);
      const vignette = ctx.createRadialGradient(256, 256, 180, 256, 256, 380);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);
      background.colorSpace = THREE.SRGBColorSpace;
      background.needsUpdate = true;
      scene.background = background;
    };
    paintBackground();

    scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2f3c, 0.9));
    // Lumière principale, avec ombres douces projetées à l'intérieur du boîtier
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(22, 60, 55);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.04;
    Object.assign(key.shadow.camera, { left: -32, right: 32, top: 40, bottom: -32, near: 10, far: 200 });
    key.target.position.copy(TARGET);
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0x9db4ff, 1.1);
    fill.position.set(-45, 20, 35);
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

    // Ombre douce au sol (dégradé radial, sans calcul d'ombres)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.45)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.7;
    scene.add(shadow);

    const model = new PcModel(this.readAccent());
    model.setSelection(this.selection(), false);
    model.setHover(this.tipSlot());
    scene.add(model.root);
    this.model = model;

    const controls = (this.controls = new OrbitControls(camera, canvas));
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 55;
    controls.maxDistance = 125;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minAzimuthAngle = -1.2;
    controls.maxAzimuthAngle = 1.2;
    controls.addEventListener('start', () => (this.lastInteraction = performance.now()));
    this.resetView();
    this.lastInteraction = 0;

    // Taille du canvas = taille du conteneur
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      // Recul automatique sur les écrans étroits pour garder le boîtier entier
      camera.zoom = Math.min(1, w / h / 1.15);
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    // Couleur d'accent du thème (claire / sombre)
    const themeObserver = new MutationObserver(() => {
      model.setAccent(this.readAccent());
      paintBackground();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

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

      // Balancement lent de la caméra quand personne n'interagit
      if (!this.reducedMotion && !this.tipSlot() && now - this.lastInteraction > IDLE_MS) {
        const offset = camera.position.clone().sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        if (spherical.theta > 0.75) this.swayDirection = -1;
        if (spherical.theta < -0.15) this.swayDirection = 1;
        spherical.theta += this.swayDirection * dt * 0.07;
        camera.position.setFromSpherical(spherical).add(controls.target);
      }

      controls.update();
      model.update(dt, now / 1000, this.reducedMotion);
      composer.render();

      // Info-bulle accrochée au-dessus de la pièce survolée
      const slot = this.tipSlot();
      if (slot) {
        model.anchorOf(slot, anchor).project(camera);
        const tip = this.tip().nativeElement;
        const x = Math.min(Math.max((anchor.x * 0.5 + 0.5) * host.clientWidth, 140), host.clientWidth - 140);
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
      motionQuery.removeEventListener('change', onMotion);
      controls.dispose();
      model.dispose();
      composer.dispose();
      bloom.dispose();
      environment.dispose();
      pmrem.dispose();
      background?.dispose();
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      shadowTexture.dispose();
      renderer.dispose();
      this.model = undefined;
    };
  }

  private readAccent(): string {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f59e0b';
  }
}
