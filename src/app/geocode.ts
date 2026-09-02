// Global address/street lookup via Nominatim (OpenStreetMap) — separate from
// the local saved-place search in poi-filters.ts. No API key, but the usage
// policy caps requests at ~1/s; callers are responsible for debouncing
// (see AddressSearch).

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => ({
      label: typeof item.display_name === 'string' ? item.display_name : '',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }))
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
