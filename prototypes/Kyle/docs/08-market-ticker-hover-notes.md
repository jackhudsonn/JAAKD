# Market Ticker Hover — Investigation Notes

Context: the header ticker pauses on hover, but in Safari the stop is abrupt
and sometimes jumps backwards by 1–2 seconds.

## Cause

The stop is CSS-only (`frontend/src/app/layout/shell/shell.component.css`):

```css
.market-ticker:hover .ticker-track {
  animation-play-state: paused;
}
```

The track animates `transform`, so Safari runs it on the compositor. The pause
is a main-thread style change; the compositor keeps its own clock and later
snaps back to the main thread's pause time. This is a known WebKit
accelerated-animation issue, not stale ticker data:
[#53513](https://wiki.webkit.org/show_bug.cgi?id=53513),
[#27808](https://www2.webkit.org/show_bug.cgi?id=27808).

Because `animation-play-state` is binary and non-transitionable, there is also
no state to ease through — hence the rigid stop.

## Direction

Own the timeline in JS. A `requestAnimationFrame` loop outside Angular's zone
writes `transform` from an explicit phase; hover eases a speed multiplier to
zero over ~200–300ms, and leave eases it back. One clock, so nothing to
desynchronize. WAAPI (`getAnimations()`, `currentTime`, `playbackRate`) is a
cleaner variant but still uses the same Safari animation engine, so test it
before relying on it.

## Also

`tickerLoopItems` duplicates the list, so `tickerDuration` (`2N * 3.5s`) covers
`N` items of travel. Effective speed is 7s/item, not the intended 3.5.
