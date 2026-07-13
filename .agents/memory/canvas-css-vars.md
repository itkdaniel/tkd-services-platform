---
name: Canvas 2D context can't resolve CSS variables
description: ctx.font / ctx.fillStyle with var(--token) silently misbehaves; always pass literal values.
---

The HTML5 Canvas 2D API (`CanvasRenderingContext2D`) does not resolve CSS
custom properties. Setting `ctx.font = "12px var(--app-font-sans)"` or
`ctx.fillStyle = "var(--color-primary)"` doesn't throw — it just silently
fails to apply the intended font/color, which breaks `ctx.measureText()`
sizing too (since the font never actually changed), causing visible
rendering bugs like mismatched label-background boxes.

**Why:** hit this in a `react-force-graph-2d` custom node/label renderer —
labels rendered with a serif fallback font and oversized white background
rectangles because `measureText` was sizing against the wrong (default)
font.

**How to apply:** whenever writing custom canvas draw code (force-directed
graphs, chart libraries with a canvas renderer, etc.) that needs to match
the app's theme, hardcode the literal font-family string and hex/rgba color
values instead of referencing CSS variables. If the theme value needs to
stay in sync, read it once via `getComputedStyle` on a DOM element rather
than assuming the canvas API can resolve it directly.
