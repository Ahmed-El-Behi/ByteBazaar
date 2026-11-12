import { Component, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheckBig,
  CircleDashed,
  CircleUserRound,
  CircuitBoard,
  Cpu,
  Eye,
  EyeOff,
  Fan,
  Gpu,
  Headphones,
  Keyboard,
  Mouse,
  Speaker,
  Webcam,
  HardDrive,
  LogOut,
  Mail,
  MapPin,
  MemoryStick,
  Monitor,
  Moon,
  Package,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Trash2,
  TriangleAlert,
  Truck,
  User,
  Wrench,
  X,
  type IconNode,
} from 'lucide';

/**
 * Jeu d'icônes du site : Lucide (licence ISC), un tracé homogène sur grille 24 px.
 * Ajouter ici toute nouvelle icône, puis l'utiliser par son nom : <app-icon name="cart" />
 */
export const ICONS = {
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  award: Award,
  box: Box,
  cart: ShoppingCart,
  check: Check,
  checkCircle: CircleCheckBig,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circle: Circle,
  circleDashed: CircleDashed,
  close: X,
  cooling: Fan,
  cpu: Cpu,
  eye: Eye,
  eyeOff: EyeOff,
  gpu: Gpu,
  headphones: Headphones,
  headset: Headphones,
  keyboard: Keyboard,
  mouse: Mouse,
  speaker: Speaker,
  webcam: Webcam,
  info: CircleAlert,
  logout: LogOut,
  mail: Mail,
  mapPin: MapPin,
  memory: MemoryStick,
  monitor: Monitor,
  moon: Moon,
  motherboard: CircuitBoard,
  orders: ShoppingBag,
  package: Package,
  power: PlugZap,
  refresh: RefreshCw,
  reset: RotateCcw,
  search: Search,
  shield: ShieldCheck,
  storage: HardDrive,
  sun: Sun,
  trash: Trash2,
  truck: Truck,
  user: User,
  userCircle: CircleUserRound,
  warning: TriangleAlert,
  wrench: Wrench,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  template: '',
  host: { 'aria-hidden': 'true', class: 'icon' },
  styles: `
    :host { display: inline-flex; flex: none; line-height: 0; vertical-align: middle; }
    :host ::ng-deep svg { display: block; }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Taille en pixels (carrée) */
  readonly size = input(20);
  /** Épaisseur du trait : 1,75 par défaut sur tout le site */
  readonly stroke = input(1.75);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  constructor() {
    effect(() => {
      const ns = 'svg';
      const svg = this.renderer.createElement('svg', ns) as SVGSVGElement;
      const attrs: Record<string, string> = {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: String(this.size()),
        height: String(this.size()),
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': String(this.stroke()),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      };
      for (const [key, value] of Object.entries(attrs)) this.renderer.setAttribute(svg, key, value);
      for (const [tag, props] of ICONS[this.name()]) {
        const child = this.renderer.createElement(tag, ns);
        for (const [key, value] of Object.entries(props)) {
          if (value !== undefined) this.renderer.setAttribute(child, key, String(value));
        }
        this.renderer.appendChild(svg, child);
      }
      for (const old of Array.from(this.host.childNodes)) this.renderer.removeChild(this.host, old);
      this.renderer.appendChild(this.host, svg);
    });
  }
}
