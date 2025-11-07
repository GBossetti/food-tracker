/**
 * Modal Service
 * Handles modal dialogs with accessibility features
 */

export interface ModalOptions {
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  trapFocus?: boolean;
}

export class ModalService {
  private activeModal: HTMLElement | null = null;
  private options: ModalOptions = {};
  private focusableElements: HTMLElement[] = [];
  private firstFocusable: HTMLElement | null = null;
  private lastFocusable: HTMLElement | null = null;
  private previousActiveElement: HTMLElement | null = null;

  /**
   * Open a modal with specified options
   */
  open(modal: HTMLElement, options: ModalOptions = {}): void {
    // Store the currently focused element to restore later
    this.previousActiveElement = document.activeElement as HTMLElement;

    this.activeModal = modal;
    this.options = options;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Setup event listeners
    if (options.closeOnBackdrop) {
      modal.addEventListener('click', this.onBackdropClick);
    }
    if (options.closeOnEsc) {
      document.addEventListener('keydown', this.onEscPress);
    }
    if (options.trapFocus) {
      this.setupFocusTrap(modal);
    }

    console.log('✅ Modal opened');
  }

  /**
   * Close the modal and cleanup
   */
  close(modal: HTMLElement): void {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove event listeners
    modal.removeEventListener('click', this.onBackdropClick);
    document.removeEventListener('keydown', this.onEscPress);
    modal.removeEventListener('keydown', this.handleTab);

    // Restore focus to previously focused element
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }

    this.activeModal = null;
    this.focusableElements = [];
    this.firstFocusable = null;
    this.lastFocusable = null;
    this.previousActiveElement = null;

    console.log('✅ Modal closed');
  }

  /**
   * Check if a modal is currently open
   */
  isOpen(): boolean {
    return this.activeModal !== null;
  }

  // --- PRIVATE METHODS ---

  private onBackdropClick = (e: MouseEvent): void => {
    // Only close if clicking the backdrop itself, not its children
    if (e.target === this.activeModal && this.options.closeOnBackdrop) {
      this.close(this.activeModal);
    }
  };

  private onEscPress = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.activeModal && this.options.closeOnEsc) {
      e.preventDefault();
      this.close(this.activeModal);
    }
  };

  private setupFocusTrap(modal: HTMLElement): void {
    // Find all focusable elements in the modal
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    this.focusableElements = Array.from(
      modal.querySelectorAll<HTMLElement>(focusableSelector)
    );

    if (this.focusableElements.length === 0) {
      console.warn('No focusable elements found in modal');
      return;
    }

    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];

    // Focus first element
    this.firstFocusable.focus();

    // Setup tab trap
    modal.addEventListener('keydown', this.handleTab);
  }

  private handleTab = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab' || !this.firstFocusable || !this.lastFocusable) {
      return;
    }

    // Shift + Tab (backwards)
    if (e.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        e.preventDefault();
        this.lastFocusable.focus();
      }
    } 
    // Tab (forwards)
    else {
      if (document.activeElement === this.lastFocusable) {
        e.preventDefault();
        this.firstFocusable.focus();
      }
    }
  };
}