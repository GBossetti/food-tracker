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
