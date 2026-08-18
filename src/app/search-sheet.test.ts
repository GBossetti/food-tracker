import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchSheet } from './search-sheet';

function buildDom(includeDetailPanel = false): void {
  document.body.innerHTML = `
    <header class="header"></header>
    <section id="search-sheet" data-snap="collapsed" data-mode="list" aria-label="Places">
      <button type="button" id="sheet-grabber" aria-label="Resize places panel" aria-expanded="false" aria-controls="search-sheet-body">
        <span class="sheet-grabber-pill" aria-hidden="true"></span>
      </button>
      <div id="search-sheet-body">
        <div id="sheet-list-panel" class="sheet-panel">
          <div class="decide-search">
            <input type="search" id="search-input" aria-label="Search places">
          </div>
          <div class="sheet-scroll-area">
            <div id="poi-list-items"></div>
          </div>
        </div>
        ${includeDetailPanel ? `
        <div id="sheet-detail-panel" class="sheet-panel" hidden>
          <header class="detail-header">
            <button type="button" id="detail-back-btn" aria-label="Back to results"></button>
            <h2 id="detail-title"></h2>
          </header>
          <div id="detail-body"></div>
        </div>` : ''}
      </div>
    </section>
  `;
}

function mockHeights(grabberH: number, searchRowH: number, headerH: number): void {
  const grabber = document.getElementById('sheet-grabber')!;
  const searchRow = document.querySelector('.decide-search')!;
  const header = document.querySelector('.header')!;
  Object.defineProperty(grabber, 'offsetHeight', { configurable: true, value: grabberH });
  Object.defineProperty(searchRow, 'offsetHeight', { configurable: true, value: searchRowH });
  header.getBoundingClientRect = () =>
    ({ height: headerH, top: 0, left: 0, right: 0, bottom: headerH, width: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

describe('SearchSheet', () => {
  beforeEach(() => {
    buildDom();
    mockHeights(24, 64, 54);
  });

  it('starts collapsed at the measured collapsed height', () => {
    const sheet = new SearchSheet();
    expect(sheet.getSnap()).toBe('collapsed');
    expect(sheet.heightPx()).toBe(88); // 24 + 64
    expect(document.documentElement.style.getPropertyValue('--sheet-h')).toBe('88px');
    expect(document.getElementById('search-sheet')!.dataset.snap).toBe('collapsed');
  });

  it('setSnap updates height, data-snap, and the grabber aria-expanded', () => {
    const sheet = new SearchSheet();
    sheet.setSnap('half');

    expect(sheet.getSnap()).toBe('half');
    expect(sheet.heightPx()).toBe(Math.round(768 * 0.5));
    expect(document.getElementById('search-sheet')!.dataset.snap).toBe('half');
    expect(document.getElementById('sheet-grabber')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('aria-expanded is false only when collapsed', () => {
    const sheet = new SearchSheet();
    expect(document.getElementById('sheet-grabber')!.getAttribute('aria-expanded')).toBe('false');
    sheet.setSnap('full');
    expect(document.getElementById('sheet-grabber')!.getAttribute('aria-expanded')).toBe('true');
    sheet.setSnap('collapsed');
    expect(document.getElementById('sheet-grabber')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('makes the scroll area inert while collapsed, and reachable otherwise', () => {
    const sheet = new SearchSheet();
    const scrollArea = document.querySelector('.sheet-scroll-area')!;
    expect(scrollArea.hasAttribute('inert')).toBe(true);

    sheet.setSnap('half');
    expect(scrollArea.hasAttribute('inert')).toBe(false);

    sheet.setSnap('collapsed');
    expect(scrollArea.hasAttribute('inert')).toBe(true);
  });

  it('clicking the grabber toggles between collapsed and half', () => {
    const sheet = new SearchSheet();
    const grabber = document.getElementById('sheet-grabber')!;

    grabber.click();
    expect(sheet.getSnap()).toBe('half');

    grabber.click();
    expect(sheet.getSnap()).toBe('collapsed');
  });

  it('clicking the grabber while full collapses it', () => {
    const sheet = new SearchSheet();
    sheet.setSnap('full');
    document.getElementById('sheet-grabber')!.click();
    expect(sheet.getSnap()).toBe('collapsed');
  });

  it('ArrowUp/ArrowDown on the grabber step through snap points', () => {
    const sheet = new SearchSheet();
    const grabber = document.getElementById('sheet-grabber')!;

    grabber.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(sheet.getSnap()).toBe('half');

    grabber.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(sheet.getSnap()).toBe('full');

    grabber.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(sheet.getSnap()).toBe('half');
  });

  it('Home jumps to full and End jumps to collapsed', () => {
    const sheet = new SearchSheet();
    const grabber = document.getElementById('sheet-grabber')!;

    grabber.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(sheet.getSnap()).toBe('full');

    grabber.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(sheet.getSnap()).toBe('collapsed');
  });

  it('focusing the search field expands a collapsed sheet to half', () => {
    const sheet = new SearchSheet();
    document.getElementById('search-input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(sheet.getSnap()).toBe('half');
  });

  it('focusing the search field does not change an already-expanded sheet', () => {
    const sheet = new SearchSheet();
    sheet.setSnap('full');
    document.getElementById('search-input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(sheet.getSnap()).toBe('full');
  });

  it('remeasure recomputes points from current measurements and reapplies the snap', () => {
    const sheet = new SearchSheet();
    mockHeights(30, 70, 54);
    sheet.remeasure();
    expect(sheet.heightPx()).toBe(100); // 30 + 70, still collapsed
  });

  it('onSnapChange fires with the new snap name', () => {
    const onSnapChange = vi.fn();
    const sheet = new SearchSheet({ onSnapChange });
    onSnapChange.mockClear(); // ignore the initial construction call
    sheet.setSnap('half');
    expect(onSnapChange).toHaveBeenCalledWith('half');
  });

  it('showDetail is a no-op when no detail panel exists in the DOM', () => {
    const sheet = new SearchSheet();
    sheet.showDetail();
    expect(sheet.getMode()).toBe('list');
  });

  describe('with a detail panel present', () => {
    beforeEach(() => {
      buildDom(true);
      mockHeights(24, 64, 54);
    });

    it('showDetail hides the list panel and shows the detail panel', () => {
      const sheet = new SearchSheet();
      sheet.showDetail();

      expect(sheet.getMode()).toBe('detail');
      expect(document.getElementById('sheet-list-panel')!.hidden).toBe(true);
      expect(document.getElementById('sheet-detail-panel')!.hidden).toBe(false);
      expect(document.getElementById('search-sheet')!.dataset.mode).toBe('detail');
    });

    it('showList reverses showDetail', () => {
      const sheet = new SearchSheet();
      sheet.showDetail();
      sheet.showList();

      expect(sheet.getMode()).toBe('list');
      expect(document.getElementById('sheet-list-panel')!.hidden).toBe(false);
      expect(document.getElementById('sheet-detail-panel')!.hidden).toBe(true);
    });

    it('collapsed height uses the detail header, not the search row, once in detail mode', () => {
      const detailHeader = document.querySelector('.detail-header')!;
      Object.defineProperty(detailHeader, 'offsetHeight', { configurable: true, value: 50 });

      const sheet = new SearchSheet();
      sheet.showDetail(); // remeasures using the now-active mode

      expect(sheet.heightPx()).toBe(74); // 24 (grabber) + 50 (detail header)
    });

    it('makes #detail-body inert while collapsed in detail mode, and reachable once expanded', () => {
      const sheet = new SearchSheet();
      sheet.showDetail();

      const detailBody = document.getElementById('detail-body')!;
      expect(detailBody.hasAttribute('inert')).toBe(true);

      sheet.setSnap('half');
      expect(detailBody.hasAttribute('inert')).toBe(false);

      sheet.setSnap('collapsed');
      expect(detailBody.hasAttribute('inert')).toBe(true);
    });
  });

  it('destroy() detaches the drag gesture so further pointer events are ignored', () => {
    const sheet = new SearchSheet();
    sheet.destroy();

    const grabber = document.getElementById('sheet-grabber')!;
    grabber.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1, bubbles: true }));
    grabber.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: -100, pointerId: 1, bubbles: true }));
    grabber.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: -100, pointerId: 1, bubbles: true }));

    expect(sheet.getSnap()).toBe('collapsed');
    expect(sheet.heightPx()).toBe(88);
  });
});
