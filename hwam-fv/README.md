# HWAM First View motion

- `index.html` — the FV itself: canvas animation (15s seamless loop) + real HTML CTA link, sound toggle (off by default), pointer parallax, `prefers-reduced-motion` support (shows the final screen).
- `assets/bgm.mp3` / `bgm.wav` — original BGM (96 BPM, 15s gapless loop), loaded only when SOUND is turned on.
- `hwam-fv.mp4` — preview with BGM. `fv-video.mp4` — silent loop, if a plain `<video>` background is preferred.
- `tools/make-bgm.mjs` → regenerate BGM from `tools/bgm-synth.js`. `tools/render.mjs` → re-render the videos (`--stills 1,4.2` for frames).

The header in `index.html` is a placeholder; replace it with the site's header. Both CTAs (header + FV) link to https://hwam-shindan.netlify.app/ (same tab).
