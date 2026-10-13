export function formatPercentageChange(changePct: number): string {
  const formattedPct = changePct.toFixed(2);

  if (changePct > 0) {
    return `+${formattedPct}% ↑`;
  }

  if (changePct < 0) {
    return `${formattedPct}% ↓`;
  }

  return `${formattedPct}%`;
}
