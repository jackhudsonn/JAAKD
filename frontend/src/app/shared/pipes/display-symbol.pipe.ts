import { Pipe, PipeTransform } from '@angular/core';
import { toDisplaySymbol } from '@shared/utils/display-symbol';

@Pipe({
  name: 'displaySymbol',
  standalone: true,
})
export class DisplaySymbolPipe implements PipeTransform {
  transform(symbol: string): string {
    return toDisplaySymbol(symbol);
  }
}
