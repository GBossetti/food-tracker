// Node's own global `localStorage` (Web Storage API, Node 22+) shadows jsdom's working
// implementation because it already exists on `globalThis` before vitest's jsdom environment
// populates its window keys — and without a valid `--localstorage-file` it's an inert stub
// (getItem/setItem/clear all undefined). Hand the global back to jsdom's real Storage.
const jsdomStorage = (globalThis as any).jsdom?.window?.localStorage;
if (jsdomStorage && typeof (globalThis as any).localStorage?.clear !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: jsdomStorage,
    configurable: true,
    writable: true,
  });
}
