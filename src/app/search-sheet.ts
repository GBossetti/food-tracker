import { resolveSnapPoints, clampHeight, heightFor, stepSnap, chooseSnap, SnapName, SnapPoints } from '../core/sheet-snap';
import { attachDragGesture } from '../core/drag-gesture';

// Fallback only for the (untestable-in-jsdom) case where .header hasn't
// been laid out yet; matches --header height in style.css.
const FALLBACK_HEADER_HEIGHT = 54;

export class SearchSheet {
  private sheet: HTMLElement;
  private grabber: HTMLElement;
  private searchRow: HTMLElement;
  private scrollArea: HTMLElement | null;
  private listPanel: HTMLElement;
  private detailPanel: HTMLElement | null;
  private searchInput: HTMLInputElement | null;
  private onSnapChange: ((s: SnapName) => void) | null;

  private snap: SnapName = 'collapsed';
  private points: SnapPoints;
  private currentHeight = 0;
  private suppressClick = false;
  private detachDrag: () => void;

  constructor(opts?: { onSnapChange?: (s: SnapName) => void }) {
    this.sheet = document.getElementById('search-sheet')!;
    this.grabber = document.getElementById('sheet-grabber')!;
    this.searchRow = this.sheet.querySelector('.decide-search')!;
    this.listPanel = document.getElementById('sheet-list-panel')!;
    this.detailPanel = document.getElementById('sheet-detail-panel');
    this.scrollArea = this.listPanel.querySelector('.sheet-scroll-area');
    this.searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    this.onSnapChange = opts?.onSnapChange ?? null;

    this.points = this.measure();
    this.applySnap('collapsed', { animate: false });

    this.grabber.addEventListener('click', () => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.setSnap(this.snap === 'collapsed' ? 'half' : 'collapsed');
    });
    this.grabber.addEventListener('keydown', (e) => this.onGrabberKeydown(e));

    this.detachDrag = attachDragGesture(this.grabber, {
      onStart: () => {
        this.sheet.classList.add('dragging');
        return this.currentHeight;
      },
      onMove: (h) => this.setHeightPx(clampHeight(h, this.points)),
      onEnd: (h, velocity, moved) => {
        this.sheet.classList.remove('dragging');
        if (!moved) return;
        this.suppressClick = true;
        const clamped = clampHeight(h, this.points);
        const next = chooseSnap(clamped, velocity, this.snap, this.points);
        this.applySnap(next, { animate: true });
      },
    });

    this.searchInput?.addEventListener('focusin', () => {
      if (this.snap === 'collapsed') this.setSnap('half');
    });

    window.addEventListener('resize', () => this.remeasure());
  }

  setSnap(name: SnapName, opts: { animate?: boolean } = {}): void {
    this.applySnap(name, opts);
  }

  getSnap(): SnapName {
    return this.snap;
  }

  showList(): void {
    this.listPanel.hidden = false;
    if (this.detailPanel) this.detailPanel.hidden = true;
    this.sheet.setAttribute('data-mode', 'list');
  }

  showDetail(): void {
    if (!this.detailPanel) return;
    this.listPanel.hidden = true;
    this.detailPanel.hidden = false;
    this.sheet.setAttribute('data-mode', 'detail');
  }

  getMode(): 'list' | 'detail' {
    return this.sheet.getAttribute('data-mode') === 'detail' ? 'detail' : 'list';
  }

  heightPx(): number {
    return this.currentHeight;
  }

  remeasure(): void {
    this.points = this.measure();
    this.applySnap(this.snap, { animate: false });
  }

  destroy(): void {
    this.detachDrag();
  }

  private measure(): SnapPoints {
    const viewportH = window.innerHeight;
    const collapsedH = this.grabber.offsetHeight + this.searchRow.offsetHeight;
    const headerH = document.querySelector('.header')?.getBoundingClientRect().height || FALLBACK_HEADER_HEIGHT;
    return resolveSnapPoints(viewportH, collapsedH, headerH);
  }

  private setHeightPx(px: number): void {
    this.currentHeight = px;
    document.documentElement.style.setProperty('--sheet-h', `${px}px`);
  }

  private applySnap(name: SnapName, opts: { animate?: boolean } = {}): void {
    const animate = opts.animate ?? true;
    this.snap = name;
    const px = heightFor(name, this.points);

    if (!animate) this.sheet.style.transition = 'none';
    this.setHeightPx(px);
    if (!animate) {
      void this.sheet.offsetHeight; // force reflow so the height commits before the transition returns
      requestAnimationFrame(() => {
        this.sheet.style.transition = '';
      });
    }

    this.sheet.setAttribute('data-snap', name);
    this.grabber.setAttribute('aria-expanded', String(name !== 'collapsed'));
    this.updateInert();
    this.onSnapChange?.(name);
  }

  private updateInert(): void {
    if (!this.scrollArea) return;
    if (this.snap === 'collapsed') {
      this.scrollArea.setAttribute('inert', '');
    } else {
      this.scrollArea.removeAttribute('inert');
    }
  }

  private onGrabberKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        this.setSnap(stepSnap(this.snap, 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.setSnap(stepSnap(this.snap, -1));
        break;
      case 'Home':
        e.preventDefault();
        this.setSnap('full');
        break;
      case 'End':
        e.preventDefault();
        this.setSnap('collapsed');
        break;
    }
  }
}
