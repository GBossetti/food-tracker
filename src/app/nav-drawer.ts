import { trapFocus } from '../core/focus-trap';
import { pushOverlay, popOverlay } from '../core/overlay-stack';

export class NavDrawer {
  private drawer: HTMLElement;
  private triggerBtn: HTMLElement | null;
  private onOpen: (() => void) | null;
  private releaseFocusTrap: (() => void) | null = null;

  constructor(opts?: { onOpen?: () => void }) {
    this.drawer = document.getElementById('nav-drawer')!;
    this.triggerBtn = document.getElementById('menu-btn');
    this.onOpen = opts?.onOpen ?? null;
    this.setup();
  }

  private setup(): void {
    this.triggerBtn?.addEventListener('click', () => this.open());
    document.getElementById('drawer-close-btn')?.addEventListener('click', () => this.close());
    this.drawer.querySelector('.nav-drawer-backdrop')?.addEventListener('click', () => this.close());
  }

  open(): void {
    this.drawer.style.display = 'flex';
    pushOverlay(this.drawer);
    this.releaseFocusTrap = trapFocus(this.drawer, { onEscape: () => this.close() });
    this.triggerBtn?.setAttribute('aria-expanded', 'true');
    this.onOpen?.();
  }

  close(): void {
    this.drawer.style.display = 'none';
    this.releaseFocusTrap?.();
    this.releaseFocusTrap = null;
    popOverlay(this.drawer);
    this.triggerBtn?.setAttribute('aria-expanded', 'false');
  }

  isOpen(): boolean {
    return this.drawer.style.display !== 'none';
  }
}
