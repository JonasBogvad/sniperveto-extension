# SniperVeto Extension

Chrome/Edge browser extension that checks Steam profile pages against the [SniperVeto](https://sniperveto.vercel.app) stream sniper database.

## What it does

Injects a status panel on Steam profile pages (`steamcommunity.com/profiles/*` and `/id/*`) showing whether the player has reports in the SniperVeto database. Includes a direct link to report the player with Steam ID and name pre-filled.

## Development

```bash
npm install
npm run dev        # builds to .output/chrome-mv3/ and watches for changes
```

**Load in Edge/Chrome:**
1. Go to `edge://extensions` (or `chrome://extensions`)
2. Enable Developer mode
3. Click Load unpacked
4. Select `.output/chrome-mv3/`

## Build for production

```bash
npm run build      # Chrome/Edge
npm run zip        # creates a .zip ready for Chrome Web Store upload
```

## Icons

Icons are required before submitting to the Chrome Web Store. Add PNG files at:
- `public/icon-16.png`
- `public/icon-32.png`
- `public/icon-48.png`
- `public/icon-128.png`

Then reference them in `wxt.config.ts`:
```ts
manifest: {
  icons: {
    16: '/icon-16.png',
    32: '/icon-32.png',
    48: '/icon-48.png',
    128: '/icon-128.png',
  }
}
```

## Architecture

| File | Purpose |
|---|---|
| `entrypoints/content.ts` | Injected on Steam profile pages. Extracts Steam ID, builds panel UI using DOM methods (no innerHTML). |
| `entrypoints/background.ts` | Service worker. Handles API calls to SniperVeto to avoid CORS restrictions in content scripts. |
| `wxt.config.ts` | Extension manifest and WXT config. |
