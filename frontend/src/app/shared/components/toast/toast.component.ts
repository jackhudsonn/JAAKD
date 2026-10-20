import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject,
} from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css',
})
export class ToastComponent implements AfterViewChecked, OnDestroy {
  readonly toastService = inject(ToastService);
  @ViewChildren('toastItem') private readonly toastItems?: QueryList<ElementRef<HTMLElement>>;

  private previousToastCount = 0;
  private previousTopById = new Map<number, number>();
  private animationFrameId: number | null = null;

  ngAfterViewChecked() {
    this.animateStackReflow();
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animateStackReflow() {
    const items = this.toastItems?.toArray() ?? [];
    const currentTopById = new Map<number, number>();
    for (const item of items) {
      const id = Number(item.nativeElement.dataset['toastId']);
      if (!Number.isNaN(id)) {
        currentTopById.set(id, item.nativeElement.offsetTop);
      }
    }

    if (items.length > this.previousToastCount) {
      const movedItems: HTMLElement[] = [];
      for (const item of items) {
        const element = item.nativeElement;
        if (element.classList.contains('dismissing')) {
          continue;
        }

        const id = Number(element.dataset['toastId']);
        if (Number.isNaN(id)) {
          continue;
        }

        const previousTop = this.previousTopById.get(id);
        const currentTop = currentTopById.get(id);
        if (previousTop === undefined || currentTop === undefined) {
          continue;
        }

        const deltaY = previousTop - currentTop;
        if (deltaY === 0) {
          continue;
        }

        element.style.transition = 'none';
        element.style.transform = `translateY(${deltaY}px)`;
        movedItems.push(element);
      }

      if (movedItems.length > 0) {
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
        }
        this.animationFrameId = requestAnimationFrame(() => {
          for (const movedItem of movedItems) {
            movedItem.style.transition = '';
            movedItem.style.transform = '';
          }
          this.animationFrameId = null;
        });
      }
    }

    this.previousToastCount = items.length;
    this.previousTopById = currentTopById;
  }
}
