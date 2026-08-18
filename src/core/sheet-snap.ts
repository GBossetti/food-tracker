export type SnapName = 'collapsed' | 'half' | 'full';

export interface SnapPoints {
  collapsed: number;
  half: number;
  full: number;
}

const ORDER: SnapName[] = ['collapsed', 'half', 'full'];

// A fling faster than this (px/ms, up positive) moves one snap step in the
// fling direction instead of settling on the nearest point. ~500 px/s is the
// conventional touch-fling threshold.
const VELOCITY_THRESHOLD = 0.5;

export function snapOrder(): SnapName[] {
  return [...ORDER];
}

/**
 * Compute the three snap heights (px) for the current viewport.
 * collapsedH is measured (grabber + search row), never a magic number.
 * full clears the app header and is capped short of the full viewport so it
 * never crowds the status bar / notch.
 */
export function resolveSnapPoints(viewportH: number, collapsedH: number, headerH: number): SnapPoints {
  const half = Math.round(viewportH * 0.5);
  const fullMax = viewportH * 0.92;
  const full = Math.min(Math.max(viewportH - headerH - 8, half), fullMax);
  return { collapsed: collapsedH, half, full };
}

export function clampHeight(h: number, p: SnapPoints): number {
  return Math.min(Math.max(h, p.collapsed), p.full);
}

export function heightFor(name: SnapName, p: SnapPoints): number {
  return p[name];
}

export function stepSnap(from: SnapName, dir: 1 | -1): SnapName {
  const idx = ORDER.indexOf(from);
  const nextIdx = Math.min(Math.max(idx + dir, 0), ORDER.length - 1);
  return ORDER[nextIdx];
}

function nearestSnap(height: number, p: SnapPoints, startSnap: SnapName): SnapName {
  let best: SnapName = ORDER[0];
  let bestDist = Infinity;
  for (const name of ORDER) {
    const dist = Math.abs(height - p[name]);
    if (dist < bestDist || (dist === bestDist && name !== startSnap)) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/**
 * Decide which snap point a released drag settles on.
 * Fast releases (|velocity| >= threshold) move exactly one step from the
 * point nearest the release height, in the fling direction — never further,
 * so a hard flick from collapsed can't jump straight to full. Slow releases
 * settle on whichever point is nearest.
 */
export function chooseSnap(height: number, velocity: number, startSnap: SnapName, p: SnapPoints): SnapName {
  const nearest = nearestSnap(height, p, startSnap);
  if (Math.abs(velocity) >= VELOCITY_THRESHOLD) {
    return stepSnap(nearest, velocity > 0 ? 1 : -1);
  }
  return nearest;
}
