# AGENTS.md

## Cursor Cloud specific instructions

This repository is a **zero-dependency static website** — a personal landing page for "Monika" (content in Croatian). It is plain HTML/CSS/JS with no package manager, no build step, no backend, and no database.

Files:
- `index.html` — page markup
- `styles.css` — styling
- `script.js` — sets the footer year and runs IntersectionObserver scroll-reveal animations

### Running it

There are no dependencies to install and nothing to build. Serve the repo root with any static HTTP server, e.g.:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

The page can also be opened directly as a `file://` URL, but serving over HTTP is preferred for dev.

### Notes

- Full-fidelity rendering (Google Fonts + the Unsplash hero image) requires internet access to those CDNs. The page falls back to system fonts and still renders without them.
- There are no lint or automated test setups in this repo (no linter config, no test framework). "Testing" is manual: serve the site and confirm the hero renders, nav anchors (`#o-meni`, `#kontakt`) scroll, sections fade in on scroll, and the footer shows the current year (proves `script.js` ran).
