import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { trapFocus } from './focus-trap';

describe('trapFocus', () => {
  let container: HTMLElement;
  let outsideButton: HTMLButtonElement;
  let first: HTMLButtonElement;
  let middle: HTMLButtonElement;
  let last: HTMLButtonElement;

  beforeEach(() => {
    outsideButton = document.createElement('button');
    outsideButton.textContent = 'outside';
    document.body.appendChild(outsideButton);

    container = document.createElement('div');
    first = document.createElement('button');
    first.textContent = 'first';
    middle = document.createElement('button');
    middle.textContent = 'middle';
    last = document.createElement('button');
    last.textContent = 'last';
    container.append(first, middle, last);
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    outsideButton.remove();
  });

  it('moves focus into the container on activation', () => {
    outsideButton.focus();
    trapFocus(container);
    expect(document.activeElement).toBe(first);
  });

  it('wraps Tab from the last element back to the first', () => {
    trapFocus(container);
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    trapFocus(container);
    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('does not interfere with Tab between elements inside the container', () => {
    trapFocus(container);
    middle.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('restores focus to the previously focused element on release', () => {
    outsideButton.focus();
    const release = trapFocus(container);
    expect(document.activeElement).toBe(first);
    release();
    expect(document.activeElement).toBe(outsideButton);
  });

  it('removes the keydown listener on release', () => {
    outsideButton.focus();
    const release = trapFocus(container);
    release();
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
