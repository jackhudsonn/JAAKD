/**
 * Small helper that periodically advances through a fixed number of steps.
 * Used by dashboard widgets that cycle between multiple displayed values
 * (e.g. Portfolio Value, Returns, Top Movers) so the interval/cleanup
 * logic isn't duplicated in every component.
 */
export function startCycleTimer(
  stepCount: number,
  intervalMs: number,
  onTick: (index: number) => void,
): () => void {
  let index = 0;
  const handle = setInterval(() => {
    index = (index + 1) % stepCount;
    onTick(index);
  }, intervalMs);

  return () => clearInterval(handle);
}
