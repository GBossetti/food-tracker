// The app's overlays (POI modal, Analytics modal, quick-visit sheet) can stack —
// logging a visit from inside the open POI modal opens the quick-visit sheet on
// top of it. Only the topmost overlay should be reachable by assistive tech;
// everything else (including a still-open lower overlay) must stay inert until
// it becomes the top again.
const ROOT_SIBLING_IDS = ['app-view', 'poi-modal', 'analytics-modal', 'quick-visit-sheet'];

const stack: HTMLElement[] = [];

function applyInert(): void {
  const top = stack[stack.length - 1];
  for (const id of ROOT_SIBLING_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (stack.length > 0 && el !== top) {
      el.setAttribute('inert', '');
    } else {
      el.removeAttribute('inert');
    }
  }
}

export function pushOverlay(el: HTMLElement): void {
  stack.push(el);
  applyInert();
}

export function popOverlay(el: HTMLElement): void {
  const idx = stack.lastIndexOf(el);
  if (idx !== -1) stack.splice(idx, 1);
  applyInert();
}

/** Test-only: clears the module-level stack between test cases. */
export function __resetOverlayStackForTests(): void {
  stack.length = 0;
}
