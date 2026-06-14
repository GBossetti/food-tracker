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

## Low / Arch

- [ ] Write `CLAUDE.md` and `README.md` — both are essentially empty
- [ ] Move hardcoded Madrid coordinates to config — `main.ts:39`, `map-engine.ts:22`
- [ ] Add localStorage data versioning and migration guard
- [ ] Add ARIA labels, focus management in modals, skip links
- [ ] Debounce `localStorage.setItem` — every UIController change triggers an immediate write
