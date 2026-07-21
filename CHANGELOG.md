# Changelog

## 2026-07-21

### Fixed

- Moved infinite-loop recentering to the end of each scroll gesture so it no longer interrupts smooth movement after the third or fourth project.
- Kept the left rail centered as a continuous current-project indicator instead of snapping from the bottom back to the top at every loop.
- Carried the active trailer frame across the hidden recenter so the project card remains visually unchanged.
- Preloaded Simulator trailers so the next project begins without waiting for its first click.
- Retried active trailer playback when media becomes ready or the user continues scrolling.
- Added an honest loading state and kept manual playback available when reduced-motion mode is enabled.

### Code change summary

- Reworked the scroll controller to debounce gesture completion, temporarily disable snap during the internal recenter, and restore the matching trailer position.
- Changed the infinite scrubber from finite-list progress to a centered loop indicator while preserving drag-to-project behavior.
- Updated the portfolio video controller to follow real playback events instead of assuming `video.play()` succeeded.
- Changed all five trailers from metadata-only loading to automatic preloading while keeping inactive videos paused.
- Versioned the playback script URL so existing visitors receive the fix immediately instead of a cached controller.

## 2026-07-20

### Added

- Built the first GitHub Pages-ready iOS portfolio with a responsive glass interface.
- Added an infinite vertical project playlist, a draggable left scrubber, and right-side navigation arrows.
- Added touch, mouse-wheel, keyboard, reduced-motion, and video playback support.
- Added five optimized Simulator trailers and poster frames for Deal Scanner, CraveCompass, Anti-Social Network, ScreenShotScan, and Wild Atlas.
- Added concise product summaries and a plain-language explanation below every trailer.
- Added site-specific metadata and a generated social-sharing card.

### Code change summary

- Built the static portfolio surface under `docs/` for GitHub Pages.
- Implemented the interaction model in `docs/app.js` and the complete responsive visual system in `docs/styles.css`.
- Added canonical GitHub Pages social metadata for rich link previews.
- Kept all iOS source repositories private; only portfolio media and descriptive copy are included.
