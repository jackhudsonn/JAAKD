export function toDisplaySymbol(symbol: string): string {
  return symbol;
  // return /^X:([^-]+)-/i.exec(symbol)?.[1] ?? symbol.replace(/\.NS$/i, '');
}
