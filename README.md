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

## UI

Single Preact island (`src/components/App.tsx`, rendered `client:only`) wired to the engine:

- **Welcome** → **Setup** (4 names required, unique, 2 teams of 2) → **Bid** (team picker + 5×5 bid grid + Misère, confirm) → **Tricks** (−/+ steppers or 0–10 chips; the other team auto-fills so the total is always 10; live made/set preview) → next hand, or **Win/Draw**.
- **Win** names the winning team, the final score, and why (reached 500 on a made bid, or a −500 ending). A short CSS confetti burst marks a win. A draw is a calm “honours even” card with no confetti. New game (same or new players) and undo stay on that screen.
- Sticky **scoreboard** on every game screen; expand for hand history with per-hand rewind (`goToHand`) and **Undo last hand** (`undo`).
- ☰ menu: past games, save to past games, new game with same players / new players, undo.
- **Past games** (Welcome, the ☰ menu, and the win screen): reopen, rename, or delete. Each row shows the teams, score, date, and outcome. Finished games are filed automatically.
- Theme: dark felt-green, CSS variables in `src/styles/global.css`. No accounts.

## Saved on this device

Scores are never stored. A game is the teams plus each hand’s bid, bidder, and tricks, and `replay` recomputes the scoreboard on load. Unreadable data is ignored.

| Key | What it holds |
| --- | --- |
| `500scorer:current-game:v1` | The game on screen: `{ v: 1, id, teams, hands }`. Opening the app resumes it. |
| `500scorer:past-games:v1` | `{ v: 1, games: [...] }`. Each game is `{ id, savedAt, updatedAt, title, teams, hands }`. `title` is an optional rename. The newest **30** are kept. |
| `500scorer:last-names:v1` | Four strings to prefill the next setup. |
| `500scorer:install-dismissed:v1` | `"1"` after the Add to Home Screen hint is dismissed. |

A win or a draw is copied into past games on its own. **Save to past games** stores a game that’s still going. Starting another game files the current one first when it has hands. Undo keeps the live game; the past snapshot follows it once that game is in the list.

## PWA

Installable on a phone: `public/site.webmanifest` (felt green `#0a3322`), a gold spade icon, and an Apple touch icon plus a few startup images. Regenerate those with `node scripts/generate-icons.mjs`. `npm run build` writes `dist/sw.js`, which precaches the app shell so scoring still works after one online visit. The welcome screen offers Install where the browser allows it, and short Safari steps on iPhone. The service worker is production-only, so `npm run dev` stays cache-free.

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
