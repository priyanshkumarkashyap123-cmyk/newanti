# BeamLab Master Prompts

## Backend master prompt

Use `o4-mini` for Rust backend, solver logic, design-code math, stiffness/matrix assembly, load combinations, safety factors, and any numerically sensitive structural logic. Use `gpt-5.4-mini` for Python and Node backend wiring, route handlers, API shaping, refactors, validation, logging, scripts, and instruction cleanup. Keep SI units, structural sign conventions, clause references, and repo conventions unchanged. Do not change engineering math unless the task explicitly needs solver-level reasoning. If the task is mixed, handle the engineering core with `o4-mini` and the surrounding implementation with `gpt-5.4-mini`.

## Frontend master prompt

Use `gpt-5.1 codex max` for React/Next.js UI, layout, Tailwind, motion, workspace panels, and any visual or UX-sensitive change. Use `gpt-5.4-mini` for small UI refactors, accessibility fixes, state/store wiring, prop cleanup, and text consistency. Keep the industrial-premium design system, responsive behavior, and accessibility standards unchanged. If the task is mixed, design the UI with `gpt-5.1 codex max` and use `gpt-5.4-mini` for implementation cleanup and consistency.

## Short debugging prompts

### Rust backend
Debug the Rust backend only. Focus on solver correctness, matrix symmetry, load paths, design-code clauses, safety factors, and SI units. Use `o4-mini` only.

### Python backend
Debug the Python backend only. Focus on API wiring, validation, route logic, scripts, logging, and refactoring. Use `gpt-5.4-mini` unless numerical solver logic is changing.

### Node backend
Debug the Node backend only. Focus on routes, handlers, service glue, response shapes, scripts, and repo conventions. Use `gpt-5.4-mini`.

### Frontend
Debug the frontend only. Focus on UI layout, Tailwind tokens, accessibility, workspace panels, motion, and state mapping. Use `gpt-5.1 codex max` for UI changes and `gpt-5.4-mini` for small consistency fixes.
