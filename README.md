# 500 Scorer

A scorekeeper for the card game **500**, rewritten with Astro + Preact + TypeScript and hosted on Cloudflare Pages.

> **4-player only.** The rewrite supports 2 teams of 2. 3-player mode from earlier plans has been dropped.

## Setup

Requires Node 22.12+ (see `.nvmrc`).

```sh
npm install
npm run dev       # local dev server
npm run build     # astro build -> dist/
npm run preview   # serve the built site
npm run check     # type-check (astro check)
npm test          # Vitest scoring-engine suite (npm run test:watch for watch mode)
```

## Scoring engine

Pure, framework-free TypeScript in `src/lib/` (tests in `tests/`):

- `bids.ts` — bid table (6♠ = 40 … 10NT = 520, closed misère = 250; no open misère / inkle)
- `scoring.ts` — `scoreHand(bid, bidder, tricks)`: made/missed, slam (10 tricks on a bid < 250 scores 250), opponents +10/trick, misère ±250 with opponents 0
- `game.ts` — immutable game state: `createGame`, `recordHand`, `getScores`, `getOutcome` (win only by reaching ≥ 500 on your own made bid; ≤ −500 ends the game, highest score wins, ties draw), `undo`, `goToHand`, `replay`

## Deploying (Cloudflare Pages)

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 22 (from `.nvmrc`, or set `NODE_VERSION=22`)

Fully static: no auth, no backend. `wrangler.toml` sets `pages_build_output_dir`; `npm run pages:deploy` deploys with Wrangler directly.

## Legacy version

The original vanilla-JS app is tagged `v1-legacy`.

## Credits

Based on [jamessacummins/500scorer](https://github.com/jamessacummins/500scorer) by James Cummins. Thanks!


## Cloudflare Pages (Git)

In the Pages project **Settings → Builds**:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |
| Build image | **v3** (production + preview) |

Do **not** put `pages_build_output_dir` in `wrangler.toml` for this Git-connected project — that made Cloudflare skip the build command and fail looking for `dist/`.

`wrangler.toml` is only for local `wrangler pages dev` / CLI deploy helpers.
