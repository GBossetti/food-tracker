import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupMenuButton } from './menu-button';

function buildDom(): { button: HTMLElement; menu: HTMLElement; outside: HTMLElement } {
  document.body.innerHTML = `
    <button id="trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="menu">More</button>
    <div id="menu" role="menu" hidden>
      <button type="button" role="menuitem" data-action="edit">Edit</button>
      <button type="button" role="menuitem" data-action="share">Share</button>
      <button type="button" role="menuitem" data-action="delete">Delete</button>
    </div>
    <button id="outside">Elsewhere</button>
  `;
  return {
    button: document.getElementById('trigger')!,
    menu: document.getElementById('menu')!,
    outside: document.getElementById('outside')!,
  };
}

function keydown(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function pointerdown(el: Element): void {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
}

describe('menu-button', () => {
  let button: HTMLElement;
  let menu: HTMLElement;
  let outside: HTMLElement;
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ button, menu, outside } = buildDom());
    onSelect = vi.fn();
  });

  it('opens the menu and focuses the first item on ArrowDown from the button', () => {
    setupMenuButton(button, menu, onSelect);
    keydown(button, 'ArrowDown');

    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('[data-action="edit"]'));
  });

  it('opens the menu and focuses the last item on ArrowUp from the button', () => {
    setupMenuButton(button, menu, onSelect);
    keydown(button, 'ArrowUp');

    expect(menu.hidden).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('[data-action="delete"]'));
  });

  it('clicking the button toggles the menu open and closed', () => {
    setupMenuButton(button, menu, onSelect);

    button.click();
    expect(menu.hidden).toBe(false);

    button.click();
    expect(menu.hidden).toBe(true);
  });

  it('sets aria-expanded on the button to match open state', () => {
    setupMenuButton(button, menu, onSelect);

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('ArrowDown/ArrowUp roving focus wraps around within the menu', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    const [edit, share, del] = items();
    expect(document.activeElement).toBe(edit);

    keydown(menu, 'ArrowDown');
    expect(document.activeElement).toBe(share);

    keydown(menu, 'ArrowDown');
    expect(document.activeElement).toBe(del);

    keydown(menu, 'ArrowDown'); // wraps past the end
    expect(document.activeElement).toBe(edit);

    keydown(menu, 'ArrowUp'); // wraps past the start
    expect(document.activeElement).toBe(del);
  });

  it('Home/End jump to the first/last item', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    keydown(menu, 'End');
    expect(document.activeElement).toBe(items()[2]);

    keydown(menu, 'Home');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('Escape closes the menu and returns focus to the button', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    keydown(menu, 'Escape');

    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('clicking a menu item closes the menu and calls onSelect with its action', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    items()[1].click(); // share

    expect(menu.hidden).toBe(true);
    expect(onSelect).toHaveBeenCalledWith('share');
  });

  it('clicking inside the menu but not on a menuitem does not select anything', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    menu.click(); // the container itself, not a menuitem

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a pointerdown outside the menu and button closes it', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    pointerdown(outside);

    expect(menu.hidden).toBe(true);
  });

  it('a pointerdown on the button itself while open does not double-close via the outside handler', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();

    pointerdown(button); // should be a no-op from the outside-click listener
    expect(menu.hidden).toBe(false); // still open — click() below does the actual toggle
  });

  it('Tab closes the menu without stealing focus back to the button', () => {
    setupMenuButton(button, menu, onSelect);
    button.click();
    items()[1].focus();

    keydown(menu, 'Tab');

    expect(menu.hidden).toBe(true);
    expect(document.activeElement).not.toBe(button);
  });

  it('detaching removes all listeners', () => {
    const detach = setupMenuButton(button, menu, onSelect);
    detach();

    button.click();
    expect(menu.hidden).toBe(true); // unchanged — no listener fired
  });

  function items(): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
});
