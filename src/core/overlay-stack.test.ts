import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pushOverlay, popOverlay, __resetOverlayStackForTests } from './overlay-stack';

function makeRootSiblings() {
  const ids = ['app-view', 'poi-modal', 'analytics-modal', 'quick-visit-sheet', 'nav-drawer'];
  const els: Record<string, HTMLElement> = {};
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    els[id] = el;
  }
  return els;
}

describe('overlay-stack', () => {
  let els: Record<string, HTMLElement>;

  beforeEach(() => {
    __resetOverlayStackForTests();
    els = makeRootSiblings();
  });

  afterEach(() => {
    Object.values(els).forEach((el) => el.remove());
  });

  it('inerts every other root sibling when one overlay opens', () => {
    pushOverlay(els['poi-modal']);
    expect(els['poi-modal'].hasAttribute('inert')).toBe(false);
    expect(els['app-view'].hasAttribute('inert')).toBe(true);
    expect(els['analytics-modal'].hasAttribute('inert')).toBe(true);
    expect(els['quick-visit-sheet'].hasAttribute('inert')).toBe(true);
    expect(els['nav-drawer'].hasAttribute('inert')).toBe(true);
  });

  it('inerts the drawer (not app-view a second time) when analytics opens from within it', () => {
    pushOverlay(els['nav-drawer']);
    pushOverlay(els['analytics-modal']);
    expect(els['analytics-modal'].hasAttribute('inert')).toBe(false);
    expect(els['nav-drawer'].hasAttribute('inert')).toBe(true);
    expect(els['app-view'].hasAttribute('inert')).toBe(true);
  });

  it('keeps a lower overlay inert while a stacked overlay is on top', () => {
    pushOverlay(els['poi-modal']);
    pushOverlay(els['quick-visit-sheet']);
    expect(els['quick-visit-sheet'].hasAttribute('inert')).toBe(false);
    expect(els['poi-modal'].hasAttribute('inert')).toBe(true);
    expect(els['app-view'].hasAttribute('inert')).toBe(true);
  });

  it('restores the lower overlay as top when the stacked one closes', () => {
    pushOverlay(els['poi-modal']);
    pushOverlay(els['quick-visit-sheet']);
    popOverlay(els['quick-visit-sheet']);
    expect(els['poi-modal'].hasAttribute('inert')).toBe(false);
    expect(els['app-view'].hasAttribute('inert')).toBe(true);
  });

  it('un-inerts everything once the stack is empty', () => {
    pushOverlay(els['poi-modal']);
    popOverlay(els['poi-modal']);
    Object.values(els).forEach((el) => expect(el.hasAttribute('inert')).toBe(false));
  });
});
