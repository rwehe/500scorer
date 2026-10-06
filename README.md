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
```

## Deploying (Cloudflare Pages)

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 22 (from `.nvmrc`, or set `NODE_VERSION=22`)

Fully static: no auth, no backend. `wrangler.toml` sets `pages_build_output_dir`; `npm run pages:deploy` deploys with Wrangler directly.

## Legacy version

The original vanilla-JS app is tagged `v1-legacy`.

## Credits

Based on [jamessacummins/500scorer](https://github.com/jamessacummins/500scorer) by James Cummins. Thanks!
