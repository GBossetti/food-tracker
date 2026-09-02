import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const dom = new JSDOM(html);
const document = dom.window.document;

function referencesNonEmptyText(document: Document, idList: string): boolean {
  return idList.split(/\s+/).every((id) => {
    const ref = document.getElementById(id);
    return !!ref && !!ref.textContent?.trim();
  });
}

function hasAccessibleLabel(el: Element): boolean {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return true;

  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby && referencesNonEmptyText(document, labelledby)) return true;

  const id = el.getAttribute('id');
  if (id) {
    const labels = Array.from(document.querySelectorAll('label[for]'));
    if (labels.some((label) => label.getAttribute('for') === id)) return true;
  }

  if (el.closest('label')) return true;

  return false;
}

function hasAccessibleName(button: Element): boolean {
  const ariaLabel = button.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return true;

  const labelledby = button.getAttribute('aria-labelledby');
  if (labelledby && referencesNonEmptyText(document, labelledby)) return true;

  if (button.textContent?.trim()) return true;

  const title = button.getAttribute('title');
  return !!title && !!title.trim();
}

describe('index.html static accessibility', () => {
  it('every non-hidden input/textarea/select resolves to a label', () => {
    const controls = Array.from(document.querySelectorAll('input, textarea, select')).filter(
      (el) =>
        el.getAttribute('type') !== 'hidden' &&
        !(el.getAttribute('style') || '').includes('display:none')
    );
    expect(controls.length).toBeGreaterThan(0);

    const unlabelled = controls.filter((el) => !hasAccessibleLabel(el));
    expect(unlabelled.map((el) => el.outerHTML)).toEqual([]);
  });

  it('every button has an accessible name (text, aria-label, or title)', () => {
    const buttons = Array.from(document.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);

    const unnamed = buttons.filter((btn) => !hasAccessibleName(btn));
    expect(unnamed.map((btn) => btn.outerHTML)).toEqual([]);
  });

  it('decorative SVGs are hidden from assistive technology', () => {
    const svgs = Array.from(document.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);

    const exposed = svgs.filter((svg) => svg.getAttribute('aria-hidden') !== 'true');
    expect(exposed.map((svg) => svg.outerHTML)).toEqual([]);
  });

  it('the search input uses type="search"', () => {
    const search = document.getElementById('search-input');
    expect(search?.getAttribute('type')).toBe('search');
  });

  it('a persistent toast live region exists', () => {
    const region = document.getElementById('toast-region');
    expect(region).not.toBeNull();
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('index.html navigation redesign markup', () => {
  it('the bottom tab bar is gone', () => {
    expect(document.querySelector('.tab-bar')).toBeNull();
    expect(document.querySelectorAll('.tab-btn').length).toBe(0);
  });

  it('the nav drawer is a root-level sibling of #app-view, not nested inside it', () => {
    const drawer = document.getElementById('nav-drawer');
    expect(drawer).not.toBeNull();
    expect(drawer?.parentElement).toBe(document.body);
    expect(document.getElementById('app-view')?.contains(drawer)).toBe(false);
  });

  it('the toast region is outside #app-view so overlays never inert it', () => {
    const region = document.getElementById('toast-region');
    const appView = document.getElementById('app-view');
    expect(appView?.contains(region)).toBe(false);
  });

  it('the hamburger menu button opens the nav drawer', () => {
    const menuBtn = document.getElementById('menu-btn');
    expect(menuBtn).not.toBeNull();
    expect(hasAccessibleName(menuBtn!)).toBe(true);
    expect(menuBtn?.getAttribute('aria-controls')).toBe('nav-drawer');
  });

  it('the sheet grabber exposes resize state and controls to assistive tech', () => {
    const grabber = document.getElementById('sheet-grabber');
    expect(grabber).not.toBeNull();
    expect(hasAccessibleName(grabber!)).toBe(true);
    expect(grabber?.hasAttribute('aria-expanded')).toBe(true);
    expect(grabber?.getAttribute('aria-controls')).toBe('search-sheet-body');
  });

  it('the search sheet is a landmark, not a dialog — it is persistent, not modal', () => {
    const sheet = document.getElementById('search-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute('aria-label')).toBeTruthy();
    expect(sheet?.hasAttribute('aria-modal')).toBe(false);
    expect(sheet?.getAttribute('role')).not.toBe('dialog');
  });

  it('the place detail overflow menu button declares its popup', () => {
    const menuBtn = document.getElementById('detail-menu-btn');
    expect(menuBtn).not.toBeNull();
    expect(menuBtn?.getAttribute('aria-haspopup')).toBe('menu');
    expect(menuBtn?.getAttribute('aria-controls')).toBe('detail-menu');
  });

  it('the detail menu items all carry role="menuitem" with a data-action', () => {
    const items = Array.from(document.querySelectorAll('#detail-menu [role="menuitem"]'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((el) => !!el.getAttribute('data-action'))).toBe(true);
  });
});

describe('index.html landing screen', () => {
  it('has no duplicate DOM title — the hero image carries the wordmark', () => {
    expect(document.querySelector('.landing-title')).toBeNull();
  });

  it('the open-map button is an icon button with an accessible name', () => {
    const btn = document.getElementById('start-app-btn');
    expect(btn).not.toBeNull();
    expect(hasAccessibleName(btn as Element)).toBe(true);
    const svg = btn?.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
