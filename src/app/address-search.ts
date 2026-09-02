import { GeocodeResult, searchAddress } from './geocode';
import { escapeHtml } from '../core/escape-html';

// Debounce independent of (and longer than) the 120ms local-filter debounce
// in ui.ts — Nominatim's usage policy caps requests at ~1/s.
const DEBOUNCE_MS = 700;
const MIN_QUERY_LENGTH = 3;

interface AddressSearchOptions {
  onSelect: (result: GeocodeResult) => void;
}

/**
 * Global address/street lookup, rendered as a distinct section beneath the
 * saved-place results list so the two result kinds are never confused.
 * Owned by AppController (not UIController) since selecting a result moves
 * the map — the same responsibility AppController already holds for
 * openPlaceDetail — and to keep ui.ts from growing further.
 */
export class AddressSearch {
  private container: HTMLElement | null;
  private onSelect: (result: GeocodeResult) => void;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private abortController: AbortController | null = null;
  private results: GeocodeResult[] = [];

  constructor(options: AddressSearchOptions) {
    this.container = document.getElementById('address-results');
    this.onSelect = options.onSelect;
  }

  handleQuery(query: string): void {
    clearTimeout(this.debounceTimer);
    this.abortController?.abort();

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      this.render([]);
      return;
    }

    this.debounceTimer = setTimeout(() => this.fetchResults(trimmed), DEBOUNCE_MS);
  }

  private async fetchResults(query: string): Promise<void> {
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const results = await searchAddress(query, controller.signal);
      if (!controller.signal.aborted) this.render(results);
    } catch {
      // Offline, aborted, or a Nominatim error — fail silently, no toast spam.
      if (!controller.signal.aborted) this.render([]);
    }
  }

  private render(results: GeocodeResult[]): void {
    this.results = results;
    if (!this.container) return;

    if (results.length === 0) {
      this.container.hidden = true;
      this.container.innerHTML = '';
      return;
    }

    this.container.hidden = false;
    this.container.innerHTML = `
      <div class="address-results-heading">Addresses</div>
      ${results
        .map(
          (r, i) =>
            `<button type="button" class="address-result-row" data-index="${i}">${escapeHtml(r.label)}</button>`
        )
        .join('')}
    `;

    this.container.querySelectorAll<HTMLButtonElement>('.address-result-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.index);
        const result = this.results[index];
        if (result) this.onSelect(result);
      });
    });
  }
}
