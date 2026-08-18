# TODO

## Critical

- [x] Remove unused `ModalService` — instantiated in `main.ts` but `UIController` never accepts it
- [x] Fix XSS vulnerability — `review.text` and `review.id` interpolated directly into `innerHTML` at `ui.ts:762–765`
- [x] Remove global `window` pollution — `window.editReview` / `window.deleteReview` set inline
- [x] Replace ~24 `any` casts across `ui.ts`, `analytics.ts`, `app-controller.ts`
- [x] Add DOM existence check before Leaflet init in `leaflet-adapter.ts:17`
- [x] Fix edit-modal trap on mobile — `form.onsubmit`/`#cancel-btn` were wired only inside `showAddPOIForm()`; opening a place via a marker or list tap (instead of "Add") left Save doing a native page-reloading form submit and the X button inert, with no other way to exit the modal on a phone. Both handlers are now wired once in `setupEventListeners()` so every entry path shares them.
- [x] Fix review stars silently overwriting the place's own rating — `.rating-input .star` matched both the main form's stars and the Reviews panel's stars (which share the `.star` class), so tapping a review star fired both handlers and clobbered `currentRating`/`#poi-rating`. Scoped the main-form binding to `#poi-panel-details .rating-input .star`.
- [x] Guard destructive import — importing replaced all data in one tap with no confirmation and no backup. Now gated behind a tap-to-confirm ("Replace N places?") and an automatic `exportToFile()` backup taken first; `storage.ts` gained `parseImportFile()` (parse-only) so the confirm step runs before anything is saved.
- [x] Surface storage write failures — `StorageLayer.save()` used to swallow quota/write errors while the UI still toasted success. `saveToLocalStorage()` now propagates the error, and `UIController.saveCurrentState()` reports failure with an error toast instead of a false success one.

## High

- [x] Add "Log visit" flow — one-tap "I went" button on wishlist place cards/modal that flips status to `visited`, captures optional note + rating, and appends to the history record (currently requires manually changing the status tile in the form)
- [x] Implement or gracefully stub backend methods — `storage.ts:148–163` throws hard on `syncToBackend()`
- [x] Fix async race in storage sync — `syncFromBackend()` can overwrite concurrent writes (`storage.ts:39–47`)
- [x] Remove dead navigation code — `app-controller.ts` references `#landing-view`, `#dashboard-content`, `.nav-tab` that don't exist in `index.html`
- [x] Remove unsafe `(this.mapEngine as any).adapter?.getMap()` cast — `app-controller.ts:150,188`
- [ ] Add a `destroy()`/teardown method to `UIController` — not a live bug today: `setupEventListeners()` is guarded by `_listenersAttached` and only runs once, and the one dynamic re-binding path (`setupTagChipInput`) already uses clone-and-replace to avoid stacking. This is architectural debt (no way to tear the controller down for hot-reload/testing), not duplicate-firing handlers.
- [x] Fix double-bound import handler — `#import-input`'s `change` event was wired in both `main.ts` and `ui.ts`; every import ran the whole pipeline twice and fired two stacked toasts. Removed the `main.ts` duplicate along with its dead sidebar-toggle code (`#toggle-sidebar-btn`/`.sidebar`/`.container` don't exist in `index.html`).
- [x] Fix dead-end Places-tab row tap — tapping a row called `mapEngine.centerOn()`, but Places is a full-screen panel with no map visible behind it (unlike Decide, which is a sheet over the live map), so the tap did nothing observable. Now opens the place's detail modal via the existing `handleFeatureClick()`.
- [x] Fix redundant geolocation requests — the silent auto-locate on app open (`app-controller.ts`) and the "Nearby" sort chip (`ui.ts`) each requested the user's location independently because the result was never shared between controllers, so tapping "Nearby" re-prompted/re-fetched location even right after a successful auto-locate. `AppController` now calls the new `UIController.setUserLocation()` with its geolocation result.
- [x] Fix quick-visit sheet "Skip" discarding the note just typed — `quick-visit-sheet.ts` now saves rating/note on Skip and on backdrop-dismiss the same way it already did on Save, whenever either was filled in.

## Medium

- [x] Polish Decide tab UX — add sort toggle (distance / rating / recently added) to `renderPOIList()` (`ui.ts:456`), and smarter empty states that distinguish "you have no places yet" from "filters are hiding results"
- [ ] Break up `UIController` god object — 1,511 lines handling search, filters, forms, reviews, analytics, import/export, modals, tags
- [ ] Add `MapEngine.off()` method — events can be subscribed but never unsubscribed
- [x] Guard `feature.properties.reviews` before `.sort()` — already resolved; both call sites (`renderReviews`, the timeline render) guard with `const reviews = feature.properties.reviews || []` on the line above the `.sort()`. The `ui.ts:1099`/`1401` line numbers above were stale (file has moved on since this was filed).
- [x] Replace `confirm()` dialogs with custom accessible modals — done in `cf16b64`; no `confirm(` remains in `ui.ts`
- [ ] Expand test coverage — `ui.ts`, `analytics.ts`, `app-controller.ts`, `map-engine.ts` have zero tests (~80% of codebase uncovered). In particular `ui.ts` has no regression coverage for the edit-modal-trap and review-star-clobbering fixes above — worth a jsdom test each once the DOM/mock harness exists.
- [ ] Replace hardcoded `setTimeout` delays for map DOM ops — `map-engine.ts`, `app-controller.ts`
- [x] Debounce search input handler in `ui.ts` — every keystroke tore down and rebuilt every Leaflet marker; resolved as part of the navigation redesign (`feat/navigation-redesign`): `MapEngine.showFeatures()` now diffs against the currently shown markers instead of clearing and rebuilding, and the search input is debounced ~120ms
- [x] De-duplicate Decide vs. Places tab logic in `ui.ts` — resolved by removing the Places tab entirely (see below); the duplicated `renderPlacesList`/`setPlacesActiveCategory`/etc. and their state fields are deleted, Decide is now the only search/browse screen
- [x] Fix `visit_count || 1` fallback in `gamification.ts` (badge totals) and `analytics.ts` — should be `visit_count ?? 0`; currently counts unvisited places (`visit_count: 0`) as 1 visit
- [ ] Cache gamification `calculateAll()` results instead of recalculating from scratch (incl. O(n²) clustering) on every Challenges/You tab visit
- [ ] Clean up gamification card click listeners on re-render (`gamification-ui.ts`) — currently re-attached without removing previous ones
- [x] Guard `importFromFile()`'s `JSON.parse()` with a try/catch and a user-facing error message instead of failing silently — superseded by the confirm-gated import rework above (`parseImportFile()` + `handleImport()`); parse failures still surface the `'Failed to import file'` toast
- [ ] Add a confirmation/export prompt before `clear()` — `StorageLayer.clear()` is currently unreferenced by any UI, so this is latent rather than live, but if it's ever wired up it needs the same tap-to-confirm + backup treatment now used for import

## Low / Arch

- [ ] Write `CLAUDE.md` and `README.md` — both are essentially empty
- [ ] Move hardcoded Madrid coordinates to config — `main.ts:35`, `map-engine.ts:22`
- [ ] Add localStorage data versioning and migration guard
- [ ] Add skip links — ARIA labels and focus management in modals are done (`fix/accessibility-visual` + `fix/accessibility-keyboard`); skip-to-content links are still missing
- [ ] Debounce `localStorage.setItem` — every UIController change triggers an immediate write
- [ ] Log a warning if `backendEnabled` is ever set `true` while `syncToBackend()`/`syncFromBackend()` remain stubs, so this isn't silently broken later

## UX/UI

- [x] Add visible `:focus-visible` rings to all interactive elements (buttons, chips, inputs) — done in `fix/accessibility-visual`
- [x] Fix `--ink-3` tertiary text color contrast — raised alpha 0.38 → 0.56 in `fix/accessibility-visual`; now ~5.3–6:1 against `--bg`/`--surface`/`--surface-2`
- [ ] Add a lightweight first-run onboarding (tooltip/tour) explaining the Map → Decide → Places → Challenges flow and the "+" add button — currently no guidance for new users beyond a hint that appears after tapping Add
- [x] Add `aria-label`s to icon-only buttons (add, close, star rating) and `role="alert"`/`aria-live` to notification toasts for screen reader support — icon-button labels done in `fix/accessibility-visual`; star ratings now `role="radio"` with `aria-label` per star (`fix/accessibility-keyboard`); toasts render into `#toast-region` with `role="alert"` (error) / `role="status"` (success) per toast
- [ ] Unify the visual language for category/status selection — POI modal uses icon tiles, filter bars use text pills, for the same underlying concept. Category colors are also defined three times with divergent hex values (`core/types.ts:10-18` vs `style.css:577-588` vs `style.css:1353-1359`) plus a fourth, unrelated palette hardcoded in `analytics-ui.ts` — collapse onto `CATEGORY_CONFIG` as the single source
- [x] Clarify or consolidate Decide vs. Places tabs — resolved by removing Places; bottom nav was Map/Decide/Challenges/You, matching the original design prototypes which never had a Places tab. **Superseded** by the navigation redesign below: the bottom tab bar itself is now gone entirely.
- [x] Show inline field-level validation errors on the POI form instead of only a generic toast on submit — done in `fix/accessibility-keyboard`: `#poi-name` gets `aria-invalid`/`aria-describedby` pointing at a visible `#poi-name-error` message, cleared live as the user types. Scoped to the name field only (lat/lng come from the map pin, not user typing, so they aren't user-fixable form fields); the native `required` inconsistency is unchanged.
- [ ] Add a loading state to the Analytics button/modal for larger datasets
- [ ] Increase the star-rating touch target (~28px currently, below the 44px mobile recommendation) — and the same for every other undersized control: "Clear filters" (~15px), tag-chip remove `×` (~13px), review edit/delete (~19px), Decide status segment (20px), sort chips (~22px), tag chips (26px), log-visit button (26px), modal close (28px), category/status chips (30px), header buttons (32px). Only the bottom tab bar currently meets 44px. **Partially done** in `fix/accessibility-visual`: Clear filters, tag-chip remove, review edit/delete, Decide status segment, and sort chips now reach the WCAG 2.2 AA 24px minimum. The 44px mobile-comfort target (AAA-ish) is still open for all of these plus the controls already ≥24px.
- [ ] Add a short explanation/tooltip on the Challenges tab describing how badges and levels are earned
- [x] Add `role="dialog"`/`aria-modal`/focus trap/focus restore to all three overlays (POI modal, Analytics modal, quick-visit sheet) — done in `fix/accessibility-keyboard` via a shared `src/core/focus-trap.ts` (Tab/Shift-Tab cycling, focus restore, per-container Escape) and `src/core/overlay-stack.ts` (`inert` on background content, stack-aware since the quick-visit sheet can open on top of the POI modal)
- [x] Make the primary interactive elements real, focusable controls instead of non-focusable `div`/`span` — done in `fix/accessibility-keyboard` for the POI list row and challenge/badge/area cards (`role="button"`, `tabindex="0"`, Enter/Space activation) and for the three star-rating sets (`role="radiogroup"`/`radio`, roving tabindex, arrow keys via `src/core/star-rating.ts`). The tag-chip remove `×` and tag autocomplete options are still unreachable by keyboard — not done.
- [ ] Add a dirty check before Escape/X/backdrop closes the POI modal — currently discards unsaved form input with no warning, and there's no `beforeunload` guard anywhere
- [ ] Style the armed "Confirm delete?" state — the two-tap destructive-confirm pattern (import, and now the place detail ⋮ menu's Delete item in `place-detail.ts`) is still an unstyled label swap with an invisible 3-second disarm timer and no dedicated `.confirming` CSS rule; the orphan `.delete-confirm-row`/`.delete-confirm-label` rules in `style.css` are dead and should either back this state or be removed
- [ ] Stack toasts instead of overlapping them — every toast is still pinned to the same `bottom:80px; left:50%` position with `white-space:nowrap`, so concurrent toasts render on top of each other and long messages overflow the viewport. The screen-reader-visibility half is done (`fix/accessibility-keyboard`): toasts render into `#toast-region` with `role="alert"`/`role="status"` per toast; only the visual stacking remains.
- [x] Add `@media (prefers-reduced-motion: reduce)` — done in `fix/accessibility-visual`; also guards the two JS `scrollIntoView({ behavior: 'smooth' })` calls in `ui.ts` via a `matchMedia` check
- [ ] Add `prefers-color-scheme`/`color-scheme: dark` support — without it, UA chrome (scrollbars, the native file picker, autofill, caret) renders light against the app's `#1A1714` dark theme; also add a `<meta name="theme-color">`
- [ ] Add `@media` breakpoints — `style.css` has zero of them in 2,301 lines, so the phone-first layout stretches unconstrained on tablet/desktop
- [x] Raise `--text-body` to 16px (currently 15px on every input) so iOS Safari stops zooming the page on focus; raise `--text-micro` (11px) and the 8.8–9.6px outliers (nav labels, tab counts, cat-tile labels) to a legible floor — done in `fix/accessibility-visual` (`--text-body` → 1rem, `--text-micro` → 0.75rem, all 8.8–9.6px outliers now use `--text-micro`)
- [ ] Remove the `order`-based active-chip reordering in the filter row (`style.css:515-517`) — tapping a status chip currently makes it jump to the front of the scroller and shifts its neighbours under the user's finger
- [x] Give active chips and earned/locked badges a non-color cue (icon, check, border weight) — done in `fix/accessibility-visual`: active category/status/sort chips get a `✓` prefix, badges get a lock icon (locked) or `✓` (earned)
- [x] Wire the Decide sheet's drag handle to an actual resize, or remove it — done in the navigation redesign (`feat/navigation-redesign`): the search sheet is now a persistent, drag-resizable bottom sheet with three real snap points (collapsed/half/full), pointer-driven drag with velocity-aware fling-to-snap (`src/core/drag-gesture.ts`, `src/core/sheet-snap.ts`), and keyboard resize on the grabber
- [ ] Add `history.pushState`/`popstate` handling — there is no routing at all today, so the back button exits the app from any open modal, there are no deep links, and the landing splash reappears on every load with no "seen it" flag. The nav drawer and the place detail view (added in the navigation redesign) are further layers the hardware/browser back button doesn't know about either.
- [ ] Save/restore list scroll position per sheet panel — `hidden` on the inactive panel (list vs. detail) resets `scrollTop` and nothing restores it on return
- [ ] Fix the dead geolocation loading indicator — `ui.ts` adds `.loading` to `#locate-btn`, but the only matching rule is `.btn.loading` and that button is `.header-btn`, so a 15-second geolocation timeout gives zero visual feedback. Add a real map-tile loading indicator too (`leaflet-adapter.ts` has no `loading`/`tileerror` handling).
- [ ] Replace the nav drawer's hardcoded placeholder markup (fake progress, two pre-earned badges, avatar "G"/"My Map" in `index.html`, moved here from the old Challenges/You tabs by the navigation redesign) with a real first-render empty state, and render gamification once at boot rather than only on drawer open; add a first-place prompt to the empty map
- [ ] Differentiate geolocation error cases (denied vs. timeout vs. unavailable) instead of one generic toast, and stop swallowing the auto-locate-on-open failure entirely; add a `window.onerror`/`unhandledrejection` handler since none exists today
- [x] Switch the search inputs to `type="search"` (currently `type="text"`), pair every placeholder-only field with a real label, and give the five `<label>`s that have no `for` attribute one — done in `fix/accessibility-visual`; verified by `src/a11y.test.ts`

