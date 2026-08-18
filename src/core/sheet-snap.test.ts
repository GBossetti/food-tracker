import { describe, it, expect } from 'vitest';
import { resolveSnapPoints, clampHeight, heightFor, stepSnap, chooseSnap, snapOrder } from './sheet-snap';

describe('sheet-snap — resolveSnapPoints', () => {
  it('uses the measured collapsed height directly, not a magic number', () => {
    const p = resolveSnapPoints(800, 64, 54);
    expect(p.collapsed).toBe(64);
  });

  it('sets half to half the viewport height', () => {
    const p = resolveSnapPoints(800, 64, 54);
    expect(p.half).toBe(400);
  });

  it('clears the header with an 8px margin on a typical viewport', () => {
    // A short-enough viewport that the 92%-of-viewport cap isn't the binding
    // constraint, so this isolates the header-clearance formula itself.
    const p = resolveSnapPoints(700, 64, 54);
    expect(p.full).toBe(700 - 54 - 8);
  });

  it('clamps full to at most 92% of viewport height on a very short header', () => {
    const p = resolveSnapPoints(800, 64, 0);
    expect(p.full).toBeLessThanOrEqual(800 * 0.92);
  });

  it('never lets full fall below half on a tiny viewport', () => {
    const p = resolveSnapPoints(300, 64, 54);
    expect(p.full).toBeGreaterThanOrEqual(p.half);
  });

  it('recomputes independently for a new viewport height (e.g. after resize)', () => {
    const tall = resolveSnapPoints(1000, 64, 54);
    const short = resolveSnapPoints(500, 64, 54);
    expect(tall.half).not.toBe(short.half);
    expect(tall.full).not.toBe(short.full);
  });
});

describe('sheet-snap — clampHeight', () => {
  const p = resolveSnapPoints(800, 64, 54);

  it('clamps below collapsed up to collapsed', () => {
    expect(clampHeight(10, p)).toBe(p.collapsed);
  });

  it('clamps above full down to full', () => {
    expect(clampHeight(2000, p)).toBe(p.full);
  });

  it('passes through values already in range', () => {
    expect(clampHeight(p.half, p)).toBe(p.half);
  });
});

describe('sheet-snap — heightFor / snapOrder', () => {
  const p = resolveSnapPoints(800, 64, 54);

  it('maps each snap name to its point', () => {
    expect(heightFor('collapsed', p)).toBe(p.collapsed);
    expect(heightFor('half', p)).toBe(p.half);
    expect(heightFor('full', p)).toBe(p.full);
  });

  it('orders snaps from smallest to largest', () => {
    expect(snapOrder()).toEqual(['collapsed', 'half', 'full']);
  });
});

describe('sheet-snap — stepSnap', () => {
  it('moves one step up', () => {
    expect(stepSnap('collapsed', 1)).toBe('half');
    expect(stepSnap('half', 1)).toBe('full');
  });

  it('moves one step down', () => {
    expect(stepSnap('full', -1)).toBe('half');
    expect(stepSnap('half', -1)).toBe('collapsed');
  });

  it('clamps at the top — stepping up from full stays at full', () => {
    expect(stepSnap('full', 1)).toBe('full');
  });

  it('clamps at the bottom — stepping down from collapsed stays at collapsed', () => {
    expect(stepSnap('collapsed', -1)).toBe('collapsed');
  });
});

describe('sheet-snap — chooseSnap', () => {
  const p = resolveSnapPoints(800, 64, 54);

  it('settles on the nearest point when released slowly', () => {
    expect(chooseSnap(p.half + 5, 0, 'half', p)).toBe('half');
    expect(chooseSnap(p.collapsed + 5, 0.1, 'collapsed', p)).toBe('collapsed');
  });

  it('a slow release near the midpoint between two snaps picks the closer one', () => {
    const mid = (p.collapsed + p.half) / 2;
    expect(chooseSnap(mid - 1, 0, 'collapsed', p)).toBe('collapsed');
    expect(chooseSnap(mid + 1, 0, 'collapsed', p)).toBe('half');
  });

  it('a fast upward fling from collapsed moves exactly one step to half, never straight to full', () => {
    expect(chooseSnap(p.collapsed + 2, 0.9, 'collapsed', p)).toBe('half');
  });

  it('a fast downward fling from full moves exactly one step to half, never straight to collapsed', () => {
    expect(chooseSnap(p.full - 2, -0.9, 'full', p)).toBe('half');
  });

  it('a fast fling already at full stays at full (clamped, no overshoot)', () => {
    expect(chooseSnap(p.full, 0.9, 'full', p)).toBe('full');
  });

  it('a fast fling already at collapsed stays at collapsed (clamped, no undershoot)', () => {
    expect(chooseSnap(p.collapsed, -0.9, 'collapsed', p)).toBe('collapsed');
  });

  it('velocity right at the threshold counts as a fling', () => {
    expect(chooseSnap(p.collapsed + 2, 0.5, 'collapsed', p)).toBe('half');
  });

  it('velocity just under the threshold settles on nearest instead', () => {
    expect(chooseSnap(p.collapsed + 2, 0.49, 'collapsed', p)).toBe('collapsed');
  });
});
