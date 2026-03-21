---
title: Contributing
description: How to contribute to Mooch
---

## Getting Started

```bash
git clone https://github.com/dweng0/Mooch.git
cd Mooch
npm install
npm run dev
```

## Running Tests

```bash
npm test
```

## Project Structure

- `src/` — Application source code (Electron main, preload, renderer)
- `scripts/` — BAADD framework scripts (evolve loop, BDD coverage checker)
- `docs/` — Landing page
- `docs-site/` — This documentation site (Starlight/Astro)

## Proposing Features

Features in Mooch are driven by BDD scenarios. To propose a new feature:

1. Open a GitHub issue describing what you'd like
2. The repo owner reviews and labels it for the AI agent to pick up
3. The agent adds scenarios to `BDD.md` and implements them test-first

## Code Changes

Pull requests are welcome. Please ensure:

- All existing tests pass (`npm test`)
- New features have corresponding test coverage
- The build succeeds (`npm run build`)
