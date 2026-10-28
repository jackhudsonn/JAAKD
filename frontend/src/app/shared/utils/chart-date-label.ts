import type { LineChartPoint } from '@shared/components/line-chart/line-chart.component';

const monthDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

// Parsed as UTC so a date never shifts a day in the viewer's timezone.
function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

// Tooltips always carry the year, even when the axis labels leave it out.
export function formatChartTooltipDate(date: string): string {
  return fullDate.format(toUtcDate(date));
}

// "Oct 20" for a range inside one year; "Oct '25" when the axis spans calendar years.
export function formatChartAxisDate(date: string, spansYears: boolean): string {
  if (!spansYears) {
    return monthDay.format(toUtcDate(date));
  }

  return `${month.format(toUtcDate(date))} '${date.slice(2, 4)}`;
}

// The span comes from the plotted points, not the selected interval: shorter history stays unambiguous.
export function toDateChartPoints(
  points: readonly { date: string; value: number }[],
): LineChartPoint[] {
  const first = points.at(0)?.date;
  const last = points.at(-1)?.date;
  const spansYears = first != null && last != null && first.slice(0, 4) !== last.slice(0, 4);

  return points.map((point) => ({
    label: formatChartAxisDate(point.date, spansYears),
    tooltipLabel: formatChartTooltipDate(point.date),
    value: point.value,
  }));
}
