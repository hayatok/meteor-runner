# Instructions for Codex (implementer)

- The single source of truth is `docs/GAME_DESIGN.md`. Implement exactly to that spec.
- Stack: Vite + Three.js (npm). Set `base: './'` in vite config. Model URLs must be
  relative via `import.meta.env.BASE_URL` (the site is served from a GitHub Pages subpath).
- Models live in `public/models/*.glb` (created separately in Blender). If a model is
  missing or fails to load, fall back to simple geometry so the game always runs.
- Do not add sound in v1. Do not change the design doc. If the spec is ambiguous,
  pick the simpler interpretation and note it in your final summary.
- Verify before finishing: `npm install` and `npm run build` must succeed.
- Write code in small, clear modules under `src/`. No TypeScript.
