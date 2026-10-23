// Rounds to the 2 decimals we display; `|| 0` turns -0 into 0 so a tiny loss never shows "-0.00".
export function roundChangePct(changePct: number): number {
  return Math.round(changePct * 100) / 100 || 0;
}

export function formatPercentageChange(changePct: number): string {
  const roundedPct = roundChangePct(changePct);
  const formattedPct = roundedPct.toFixed(2);

  if (roundedPct > 0) {
    return `+${formattedPct}% ↑`;
  }

  if (roundedPct < 0) {
    return `${formattedPct}% ↓`;
  }

  return `${formattedPct}%`;
}
