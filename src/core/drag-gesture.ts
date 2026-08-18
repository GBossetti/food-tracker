// Pixels of movement before a gesture is claimed as a drag (vs. a tap, or
// something else claiming it — e.g. the results list's own vertical scroll).
const SLOP = 6;

export interface DragGestureOptions {
  /** Called once on pointerdown; returns the current value (e.g. sheet height in px). */
  onStart: () => number;
  /** Called (rAF-coalesced) while a claimed drag is in progress, with the new value. */
  onMove: (value: number) => void;
  /**
   * Called once per tracked pointer, on release or cancel — even if the drag
   * was never claimed. `moved` is true only if `claim` accepted the gesture.
   */
  onEnd: (value: number, velocity: number, moved: boolean) => void;
  /**
   * Decides, once slop is exceeded, whether this gesture belongs to this
   * drag (true) or should be left alone for something else — e.g. native
   * scroll — to handle (false). Evaluated exactly once per gesture.
   * Default: vertical movement that dominates horizontal movement.
   */
  claim?: (dx: number, dy: number) => boolean;
  /** Flips which pointer direction increases the value. Default: up increases it. */
  invert?: boolean;
}

const defaultClaim = (dx: number, dy: number): boolean =>
  Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SLOP;

/**
 * Attaches a pointer-driven drag gesture to `el`: one code path for touch,
 * mouse, and pen via the Pointer Events API. Tracks a single pointer at a
 * time, arbitrates ownership once via `claim`, and reports velocity (in
 * value-units per millisecond, computed from the same sign convention as
 * `onMove`'s value) so the caller can decide fling behavior.
 */
export function attachDragGesture(el: HTMLElement, opts: DragGestureOptions): () => void {
  const claim = opts.claim ?? defaultClaim;
  const sign = opts.invert ? 1 : -1;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startValue = 0;
  let lastValue = 0;
  let lastT = 0;
  let velocity = 0;
  let decided: 'drag' | 'ignore' | null = null;
  let rafId: number | null = null;
  let pendingValue: number | null = null;
  let lastEmitted: number | null = null;

  function scheduleMove(value: number): void {
    pendingValue = value;
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendingValue !== null && pendingValue !== lastEmitted) {
        lastEmitted = pendingValue;
        opts.onMove(pendingValue);
      }
    });
  }

  function onPointerDown(e: PointerEvent): void {
    if (pointerId !== null) return; // already tracking a pointer
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startValue = opts.onStart();
    lastValue = startValue;
    lastT = performance.now();
    velocity = 0;
    decided = null;
    pendingValue = null;
    lastEmitted = null;
    el.setPointerCapture?.(pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (pointerId === null || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (decided === null) {
      if (Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) return;
      decided = claim(dx, dy) ? 'drag' : 'ignore';
    }
    if (decided !== 'drag') return;

    const value = startValue + sign * dy;
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    const instant = (value - lastValue) / dt;
    velocity = 0.7 * instant + 0.3 * velocity;
    lastValue = value;
    lastT = now;

    scheduleMove(value);
  }

  function finish(e: PointerEvent): void {
    if (pointerId === null || e.pointerId !== pointerId) return;
    el.releasePointerCapture?.(pointerId);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const moved = decided === 'drag';
    const finalValue = lastValue;
    pointerId = null;
    decided = null;
    pendingValue = null;
    lastEmitted = null;
    opts.onEnd(finalValue, velocity, moved);
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
