export class QuickVisitSheet {
  private sheet: HTMLElement;
  private rating: number = 0;
  private onSave: ((rating: number, text: string) => void) | null = null;

  constructor() {
    this.sheet = document.getElementById('quick-visit-sheet')!;
    this.setup();
  }

  private setup(): void {
    this.sheet.querySelectorAll<HTMLElement>('.qvs-star').forEach((star) => {
      star.addEventListener('click', () => {
        const r = parseInt(star.dataset.rating || '0');
        this.rating = r;
        this.sheet.querySelectorAll('.qvs-star').forEach((s, i) => {
          s.textContent = i < r ? '★' : '☆';
          (s as HTMLElement).classList.toggle('active', i < r);
        });
      });
    });

    this.sheet.querySelector('.qvs-backdrop')?.addEventListener('click', () => this.closeAndSave());
    document.getElementById('qvs-skip-btn')?.addEventListener('click', () => this.closeAndSave());
    document.getElementById('qvs-save-btn')?.addEventListener('click', () => this.closeAndSave());
  }

  // Skip and backdrop-dismiss used to discard a note the user had already
  // typed; anything worth keeping (a rating or a note) is saved on any close.
  private closeAndSave(): void {
    const note = (document.getElementById('qvs-note') as HTMLTextAreaElement).value.trim();
    if (this.rating > 0 || note) {
      this.onSave?.(this.rating, note);
    }
    this.close();
  }

  open(placeName: string, onSave: (rating: number, text: string) => void): void {
    this.onSave = onSave;
    this.rating = 0;

    const nameEl = this.sheet.querySelector<HTMLElement>('.qvs-place-name');
    if (nameEl) nameEl.textContent = placeName;

    (document.getElementById('qvs-note') as HTMLTextAreaElement).value = '';

    this.sheet.querySelectorAll('.qvs-star').forEach((s) => {
      s.textContent = '☆';
      (s as HTMLElement).classList.remove('active');
    });

    this.sheet.style.display = 'flex';
  }

  private close(): void {
    this.sheet.style.display = 'none';
    this.onSave = null;
  }
}
