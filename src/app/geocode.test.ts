import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchAddress } from './geocode';

describe('searchAddress', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds a Nominatim URL with the query, jsonv2 format, and a result limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    globalThis.fetch = fetchMock as any;

    await searchAddress('Gran Vía, Madrid');

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://nominatim.openstreetmap.org/search');
    expect(url).toContain('format=jsonv2');
    expect(url).toContain('limit=5');
    expect(url).toContain(encodeURIComponent('Gran Vía, Madrid'));
  });

  it('maps display_name/lat/lon to label/lat/lng', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Gran Vía, Madrid, Spain', lat: '40.4200', lon: '-3.7050' },
      ],
    }) as any;

    const results = await searchAddress('Gran Vía');

    expect(results).toEqual([{ label: 'Gran Vía, Madrid, Spain', lat: 40.42, lng: -3.705 }]);
  });

  it('filters out results with unparseable coordinates or an empty label', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Valid Place', lat: '40.0', lon: '-3.0' },
        { display_name: 'Bad Coords', lat: 'not-a-number', lon: '-3.0' },
        { display_name: '', lat: '40.0', lon: '-3.0' },
      ],
    }) as any;

    const results = await searchAddress('anything');

    expect(results).toEqual([{ label: 'Valid Place', lat: 40.0, lng: -3.0 }]);
  });

  it('returns an empty array when the response body is not an array', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'nope' }),
    }) as any;

    const results = await searchAddress('anything');

    expect(results).toEqual([]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => [],
    }) as any;

    await expect(searchAddress('anything')).rejects.toThrow('503');
  });

  it('passes the given AbortSignal through to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    globalThis.fetch = fetchMock as any;
    const controller = new AbortController();

    await searchAddress('anything', controller.signal);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ signal: controller.signal });
  });
});
