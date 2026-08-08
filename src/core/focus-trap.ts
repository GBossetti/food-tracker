const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

export interface TrapFocusOptions {
  /** Called when Escape is pressed while focus is inside the container. */
  onEscape?: () => void;
}

/**
 * Traps keyboard focus within `container`: moves focus in, cycles Tab/Shift-Tab
 * among its focusable elements, and restores focus to whatever was focused
 * before on release. Returns the release function.
 *
 * Because the listener is scoped to `container` rather than `document`, it only
 * ever fires for whichever overlay currently holds focus — so when overlays are
 * stacked (see overlay-stack.ts), Escape naturally closes just the topmost one.
 */
export function trapFocus(container: HTMLElement, options: TrapFocusOptions = {}): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const focusFirst = () => {
    const focusable = getFocusable(container);
    (focusable[0] ?? container).focus();
  };

  if (!container.contains(document.activeElement)) {
    focusFirst();
  }

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      options.onEscape?.();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', onKeydown);

  return () => {
    container.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus();
  };
}
