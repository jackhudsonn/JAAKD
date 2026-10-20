import { Injectable, signal } from '@angular/core';

export type ToastTone = 'error' | 'success' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastMessages = signal<readonly ToastMessage[]>([]);
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.toastMessages.asReadonly();

  show(text: string, tone: ToastTone = 'info', durationMs = 10000): number {
    const message = text.trim();
    if (!message) {
      return -1;
    }

    const id = this.nextId++;
    this.toastMessages.update((toasts) => [{ id, tone, text: message }, ...toasts]);

    const timer = setTimeout(() => this.dismiss(id), durationMs);
    this.dismissTimers.set(id, timer);
    return id;
  }

  error(text: string, durationMs = 10000): number {
    return this.show(text, 'error', durationMs);
  }

  success(text: string, durationMs = 10000): number {
    return this.show(text, 'success', durationMs);
  }

  info(text: string, durationMs = 10000): number {
    return this.show(text, 'info', durationMs);
  }

  dismiss(id: number) {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }

    this.toastMessages.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
