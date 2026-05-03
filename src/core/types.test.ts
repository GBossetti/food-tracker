import { describe, it, expect } from 'vitest';
import { CATEGORY_CONFIG, POICategory } from './types';

describe('CATEGORY_CONFIG', () => {
  const categories: POICategory[] = ['restaurant', 'cafe', 'bar', 'bakery', 'market', 'other'];

  it('has an entry for every category', () => {
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat]).toBeDefined();
    });
  });

  it('each entry has a label, color, and textColor', () => {
    categories.forEach(cat => {
      const config = CATEGORY_CONFIG[cat];
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.textColor).toBeTruthy();
    });
  });

  it('colors are valid hex values', () => {
    const hexColor = /^#[0-9A-Fa-f]{6}$/;
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat].color).toMatch(hexColor);
    });
  });

  it('restaurant uses the primary teal color', () => {
    expect(CATEGORY_CONFIG.restaurant.color).toBe('#0088AA');
  });

  it('each category has a distinct color', () => {
    const colors = categories.map(cat => CATEGORY_CONFIG[cat].color);
    const unique = new Set(colors);
    expect(unique.size).toBe(categories.length);
  });
});
