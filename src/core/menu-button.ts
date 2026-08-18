/**
 * Wires a trigger button to a `role="menu"` popup: roving arrow-key focus
 * among `[role="menuitem"]` children, Home/End, Escape-to-close-and-restore,
 * outside-pointerdown-to-close, and click/Enter/Space activation (the
 * latter two via the button's native click synthesis — not handled here).
 *
 * `onSelect` may return `true` to keep the menu open after activation — for
 * an item that needs a second confirming click (e.g. "Delete" toggling to
 * "Confirm delete?") rather than a nested dialog.
 */
export function setupMenuButton(
  button: HTMLElement,
  menu: HTMLElement,
  onSelect: (action: string) => boolean | void
): () => void {
  let open = false;
  let outsidePointerListener: ((e: PointerEvent) => void) | null = null;

  function items(): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function openMenu(focusLast = false): void {
    if (open) return;
    open = true;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');

    const list = items();
    (focusLast ? list[list.length - 1] : list[0])?.focus();

    outsidePointerListener = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && (menu.contains(target) || button.contains(target))) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', outsidePointerListener);
  }

  function closeMenu(restoreFocus = true): void {
    if (!open) return;
    open = false;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (outsidePointerListener) {
      document.removeEventListener('pointerdown', outsidePointerListener);
      outsidePointerListener = null;
    }
    if (restoreFocus) button.focus();
  }

  function onButtonClick(): void {
    if (open) closeMenu();
    else openMenu();
  }

  function onButtonKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(true);
    }
  }

  function onMenuKeydown(e: KeyboardEvent): void {
    const list = items();
    const idx = list.indexOf(document.activeElement as HTMLElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        list[(idx + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        list[(idx - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        list[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        // Let the browser move focus natively; just drop the open menu state.
        closeMenu(false);
        break;
    }
  }

  function onMenuClick(e: MouseEvent): void {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
    if (!item) return;
    const action = item.dataset.action;
    if (!action) return;
    const keepOpen = onSelect(action);
    if (!keepOpen) closeMenu();
  }

  button.addEventListener('click', onButtonClick);
  button.addEventListener('keydown', onButtonKeydown);
  menu.addEventListener('keydown', onMenuKeydown);
  menu.addEventListener('click', onMenuClick);

  return () => {
    button.removeEventListener('click', onButtonClick);
    button.removeEventListener('keydown', onButtonKeydown);
    menu.removeEventListener('keydown', onMenuKeydown);
    menu.removeEventListener('click', onMenuClick);
    if (outsidePointerListener) document.removeEventListener('pointerdown', outsidePointerListener);
  };
}
