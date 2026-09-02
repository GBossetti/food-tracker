import { GeoJSONFeature, POICategory, POIStatus } from './types';

export interface FilterOptions {
  category: POICategory | 'all';
  status: POIStatus | 'all';
  selectedTags: Set<string>;
  searchTerm: string;
}

// Folds diacritics so "japon" matches "Japón" and "cafe" matches "Café" —
// names in this app span many languages/scripts.
function foldDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function matchesFilters(feature: GeoJSONFeature, options: FilterOptions): boolean {
  const { category, status, selectedTags, searchTerm } = options;

  if (category !== 'all') {
    const cat = feature.properties.category || 'restaurant';
    if (cat !== category) return false;
  }

  if (status !== 'all') {
    const st = feature.properties.status || 'visited';
    if (st !== status) return false;
  }

  if (selectedTags.size > 0) {
    const featureTags: string[] = feature.properties.tags || [];
    if (!featureTags.some(tag => selectedTags.has(tag))) return false;
  }

  if (searchTerm) {
    const term = foldDiacritics(searchTerm);
    const name = foldDiacritics(feature.properties.name || '');
    const comments = foldDiacritics(feature.properties.comments || '');
    const tags = foldDiacritics((feature.properties.tags || []).join(' '));
    if (!name.includes(term) && !comments.includes(term) && !tags.includes(term)) return false;
  }

  return true;
}
