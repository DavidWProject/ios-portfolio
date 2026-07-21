# Changelog

## 2026-07-21

### Fixed

- Removed the downward recenter entirely; the playlist now extends itself ahead of the viewer so scrolling never reverses or repeats a project.
- Kept the left rail centered as a continuous current-project indicator instead of snapping from the bottom back to the top at every loop.
- Kept the rare upward safety recenter out of active scroll motion and carried its trailer frame across unchanged.
- Allowed repeated wheel and trackpad input to continue through snap points without trapping the next gesture.
- Preloaded Simulator trailers so the next project begins without waiting for its first click.
- Retried active trailer playback when media becomes ready or the user continues scrolling.
- Added an honest loading state and kept manual playback available when reduced-motion mode is enabled.

### Code change summary

- Added a forward cycle buffer that appends fully wired project cards before the viewer reaches the end of the playlist.
- Limited internal recentering to upward navigation, after the gesture finishes.
- Changed project snap stops from forced to normal while preserving centered project settling.
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
