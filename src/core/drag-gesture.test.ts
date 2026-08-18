import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachDragGesture } from './drag-gesture';

function tick(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function fire(el: HTMLElement, type: string, opts: { clientX: number; clientY: number; pointerId?: number }) {
  el.dispatchEvent(new PointerEvent(type, { clientX: opts.clientX, clientY: opts.clientY, pointerId: opts.pointerId ?? 1, bubbles: true }));
}

describe('drag-gesture', () => {
  let el: HTMLElement;
  let clock: number;

  beforeEach(() => {
    el = document.createElement('div');
    document.body.appendChild(el);
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });

  afterEach(() => {
    el.remove();
    vi.restoreAllMocks();
  });

  it('calls onStart on pointerdown', () => {
    const onStart = vi.fn().mockReturnValue(100);
    attachDragGesture(el, { onStart, onMove: vi.fn(), onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('does not call onMove until movement exceeds slop', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -3 }); // under 6px slop
    await tick();

    expect(onMove).not.toHaveBeenCalled();
  });

  it('claims a vertical drag by default and reports the derived value', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -20 }); // up 20px
    await tick();

    // default: up increases the value
    expect(onMove).toHaveBeenCalledWith(120);
  });

  it('invert flips which pointer direction increases the value', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn(), invert: true });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: 20 }); // down 20px
    await tick();

    expect(onMove).toHaveBeenCalledWith(120);
  });

  it('axis lock rejects a mostly-horizontal gesture by default', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 20, clientY: 2 }); // mostly horizontal
    await tick();

    expect(onMove).not.toHaveBeenCalled();
  });

  it('once rejected, a gesture stays rejected even if it turns vertical later', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 20, clientY: 2 }); // rejected (horizontal)
    fire(el, 'pointermove', { clientX: 20, clientY: 40 }); // now mostly vertical, but too late
    await tick();

    expect(onMove).not.toHaveBeenCalled();
  });

  it('a custom claim callback can veto a gesture entirely', async () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd, claim: () => false });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -50 });
    await tick();
    fire(el, 'pointerup', { clientX: 0, clientY: -50 });

    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(100, 0, false);
  });

  it('onEnd fires with moved=false and the unchanged value for a pure tap', () => {
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointerup', { clientX: 0, clientY: 0 });

    expect(onEnd).toHaveBeenCalledWith(100, 0, false);
  });

  it('onEnd fires with moved=true and the final value after a claimed drag', async () => {
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -20 });
    await tick();
    fire(el, 'pointerup', { clientX: 0, clientY: -20 });

    expect(onEnd).toHaveBeenCalledWith(120, expect.any(Number), true);
  });

  it('pointercancel ends the gesture the same way pointerup does', () => {
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointercancel', { clientX: 0, clientY: 0 });

    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('ignores further pointermove/up after the tracked pointer ends', () => {
    const onStart = vi.fn().mockReturnValue(100);
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointerup', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -50 });
    fire(el, 'pointerup', { clientX: 0, clientY: -50 });

    expect(onStart).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('ignores a second simultaneous pointer while one is already tracked', () => {
    const onStart = vi.fn().mockReturnValue(100);
    attachDragGesture(el, { onStart, onMove: vi.fn(), onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
    fire(el, 'pointerdown', { clientX: 0, clientY: 0, pointerId: 2 });

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('does not throw when setPointerCapture is unavailable (jsdom has no implementation)', () => {
    expect((el as any).setPointerCapture).toBeUndefined();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd: vi.fn() });
    expect(() => {
      fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
      fire(el, 'pointermove', { clientX: 0, clientY: -20 });
      fire(el, 'pointerup', { clientX: 0, clientY: -20 });
    }).not.toThrow();
  });

  it('reports positive velocity for a fast upward drag (default, up = positive)', async () => {
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    clock = 10;
    fire(el, 'pointermove', { clientX: 0, clientY: -20 }); // fast move up
    await tick();
    clock = 20;
    fire(el, 'pointerup', { clientX: 0, clientY: -20 });

    const [, velocity, moved] = onEnd.mock.calls[0];
    expect(moved).toBe(true);
    expect(velocity).toBeGreaterThan(0);
  });

  it('reports negative velocity for a fast downward drag (default)', async () => {
    const onEnd = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove: vi.fn(), onEnd });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    clock = 10;
    fire(el, 'pointermove', { clientX: 0, clientY: 20 }); // fast move down
    await tick();
    clock = 20;
    fire(el, 'pointerup', { clientX: 0, clientY: 20 });

    const [, velocity] = onEnd.mock.calls[0];
    expect(velocity).toBeLessThan(0);
  });

  it('coalesces rapid synchronous moves into a single onMove per frame, using the latest value', async () => {
    const onMove = vi.fn();
    attachDragGesture(el, { onStart: () => 100, onMove, onEnd: vi.fn() });

    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });
    fire(el, 'pointermove', { clientX: 0, clientY: -20 });
    fire(el, 'pointermove', { clientX: 0, clientY: -30 });
    fire(el, 'pointermove', { clientX: 0, clientY: -40 });
    await tick();

    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledWith(140);
  });

  it('detaching removes all listeners', () => {
    const onStart = vi.fn().mockReturnValue(100);
    const detach = attachDragGesture(el, { onStart, onMove: vi.fn(), onEnd: vi.fn() });

    detach();
    fire(el, 'pointerdown', { clientX: 0, clientY: 0 });

    expect(onStart).not.toHaveBeenCalled();
  });
});
