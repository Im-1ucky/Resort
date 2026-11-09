# The Estate — Frontend

Next.js App Router frontend for The Estate resort booking platform.

## Development

```bash
bun install
bun run dev
```

## Validation

```bash
bun run lint
bun run build
```

## Source structure

- `src/app/` — Next.js routes and layouts.
- `src/pages/` — page implementations imported by route entrypoints.
- `src/components/` — reusable UI components grouped by area.
- `src/contexts/` — shared React context providers.
- `src/services/` — API communication.
- `src/utils/` — shared utility functions.
- `src/styles/` — additional shared styles (created when needed).

Environment variables are intentionally not included in this archive.
