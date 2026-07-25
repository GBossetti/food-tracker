# TODO

## Critical

- [x] Remove unused `ModalService` — instantiated in `main.ts` but `UIController` never accepts it
- [x] Fix XSS vulnerability — `review.text` and `review.id` interpolated directly into `innerHTML` at `ui.ts:762–765`
- [x] Remove global `window` pollution — `window.editReview` / `window.deleteReview` set inline
- [x] Replace ~24 `any` casts across `ui.ts`, `analytics.ts`, `app-controller.ts`
- [x] Add DOM existence check before Leaflet init in `leaflet-adapter.ts:17`

## High

- [x] Add "Log visit" flow — one-tap "I went" button on wishlist place cards/modal that flips status to `visited`, captures optional note + rating, and appends to the history record (currently requires manually changing the status tile in the form)
- [x] Implement or gracefully stub backend methods — `storage.ts:148–163` throws hard on `syncToBackend()`
- [x] Fix async race in storage sync — `syncFromBackend()` can overwrite concurrent writes (`storage.ts:39–47`)
- [x] Remove dead navigation code — `app-controller.ts` references `#landing-view`, `#dashboard-content`, `.nav-tab` that don't exist in `index.html`
- [x] Remove unsafe `(this.mapEngine as any).adapter?.getMap()` cast — `app-controller.ts:150,188`
- [ ] Add event listener cleanup — `setupEventListeners()` in `ui.ts` never removes handlers

## Medium

- [x] Polish Decide tab UX — add sort toggle (distance / rating / recently added) to `renderPOIList()` (`ui.ts:456`), and smarter empty states that distinguish "you have no places yet" from "filters are hiding results"
- [ ] Break up `UIController` god object — 1,140 lines handling search, filters, forms, reviews, analytics, import/export, modals, tags
- [ ] Add `MapEngine.off()` method — events can be subscribed but never unsubscribed
- [ ] Guard `feature.properties.reviews` before `.sort()` — null ref at `ui.ts:751`
- [ ] Replace `confirm()` dialogs with custom accessible modals — `ui.ts:339,884`
- [ ] Expand test coverage — `ui.ts`, `analytics.ts`, `app-controller.ts`, `map-engine.ts` have zero tests (~80% of codebase uncovered)
- [ ] Replace hardcoded `setTimeout` delays for map DOM ops — `map-engine.ts`, `app-controller.ts`
- [ ] Debounce search input handler in `ui.ts`
- [ ] De-duplicate Decide vs. Places tab logic in `ui.ts` — ~95% identical filter/sort/render methods maintained twice (`renderPOIList`/`renderPlacesList`, `setActiveCategory`/`setPlacesActiveCategory`, etc.)
- [x] Fix `visit_count || 1` fallback in `gamification.ts` (badge totals) and `analytics.ts` — should be `visit_count ?? 0`; currently counts unvisited places (`visit_count: 0`) as 1 visit
- [ ] Cache gamification `calculateAll()` results instead of recalculating from scratch (incl. O(n²) clustering) on every Challenges/You tab visit
- [ ] Clean up gamification card click listeners on re-render (`gamification-ui.ts`) — currently re-attached without removing previous ones
- [ ] Guard `importFromFile()`'s `JSON.parse()` with a try/catch and a user-facing error message instead of failing silently
- [ ] Add a confirmation/export prompt before `clear()` — currently a single click permanently deletes all local data with no recovery path

## Low / Arch

- [ ] Write `CLAUDE.md` and `README.md` — both are essentially empty
- [ ] Move hardcoded Madrid coordinates to config — `main.ts:39`, `map-engine.ts:22`
- [ ] Add localStorage data versioning and migration guard
- [ ] Add ARIA labels, focus management in modals, skip links
- [ ] Debounce `localStorage.setItem` — every UIController change triggers an immediate write
- [ ] Log a warning if `backendEnabled` is ever set `true` while `syncToBackend()`/`syncFromBackend()` remain stubs, so this isn't silently broken later

## UX/UI

- [ ] Add visible `:focus-visible` rings to all interactive elements (buttons, chips, inputs) — keyboard navigation currently has no visible focus indicator anywhere except form inputs
- [ ] Fix `--ink-3` tertiary text color contrast — fails WCAG AA against the dark background; used for tab counts, section labels, meta text
- [ ] Add a lightweight first-run onboarding (tooltip/tour) explaining the Map → Decide → Places → Challenges flow and the "+" add button — currently no guidance for new users beyond a hint that appears after tapping Add
- [ ] Add `aria-label`s to icon-only buttons (add, close, star rating) and `role="alert"`/`aria-live` to notification toasts for screen reader support
- [ ] Unify the visual language for category/status selection — POI modal uses icon tiles, filter bars use text pills, for the same underlying concept
- [ ] Clarify or consolidate Decide vs. Places tabs — near-total feature/UI overlap with no explanation of when to use which
- [ ] Show inline field-level validation errors on the POI form instead of only a generic toast on submit
- [ ] Add a loading state to the Analytics button/modal for larger datasets
- [ ] Increase the star-rating touch target (~28px currently, below the 44px mobile recommendation)
- [ ] Add a short explanation/tooltip on the Challenges tab describing how badges and levels are earned
