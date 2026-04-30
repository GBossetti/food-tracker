import { describe, it, expect } from 'vitest';
import { CATEGORY_CONFIG, POICategory } from './types';

describe('CATEGORY_CONFIG', () => {
  const categories: POICategory[] = ['food', 'monuments', 'entertainment', 'museums', 'other'];

  it('has an entry for every category', () => {
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat]).toBeDefined();
    });
  });

  it('each entry has a label, color and symbol', () => {
    categories.forEach(cat => {
      const config = CATEGORY_CONFIG[cat];
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.symbol).toBeTruthy();
    });
  });

  it('colors are valid hex values', () => {
    const hexColor = /^#[0-9A-Fa-f]{6}$/;
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat].color).toMatch(hexColor);
    });
  });

  it('symbols are single characters', () => {
    categories.forEach(cat => {
      expect(CATEGORY_CONFIG[cat].symbol).toHaveLength(1);
    });
  });

  it('food uses the primary teal color', () => {
    expect(CATEGORY_CONFIG.food.color).toBe('#0088AA');
  });

  it('each category has a distinct color', () => {
    const colors = categories.map(cat => CATEGORY_CONFIG[cat].color);
    const unique = new Set(colors);
    expect(unique.size).toBe(categories.length);
  });
});
