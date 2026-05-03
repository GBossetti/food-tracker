import { GeoJSONFeature, POICategory, POIStatus } from './types';

export interface FilterOptions {
  category: POICategory | 'all';
  status: POIStatus | 'all';
  selectedTags: Set<string>;
  searchTerm: string;
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
    const term = searchTerm.toLowerCase();
    const name = (feature.properties.name || '').toLowerCase();
    const comments = (feature.properties.comments || '').toLowerCase();
    const tags = (feature.properties.tags || []).join(' ').toLowerCase();
    if (!name.includes(term) && !comments.includes(term) && !tags.includes(term)) return false;
  }

  return true;
}
