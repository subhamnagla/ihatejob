# Installing it as an app, and deploying it

## It is live

<https://ihatejob.vercel.app>

That deployment was made **without logging in**, using Vercel's temporary
deployment flow. It works and it is public, but it currently sits in an
unclaimed account rather than yours.

### Claim it into your own account

Do this before you point a domain at it, or you cannot manage it.

```bash
npx vercel login          # opens your browser
npx vercel claim          # moves the deployment into your account
```

If `claim` is not offered, the simpler route is to log in and redeploy — the
same URL is reissued under your account:

```bash
npx vercel login
rm -rf .vercel            # forget the temporary project link
npx vercel --prod
```

### Later deployments

```bash
npx vercel            # preview URL, safe for trying things
npx vercel --prod     # replaces the live site
```

Or connect the GitHub repository at <https://vercel.com/new> and every push to
`main` deploys itself.

### Adding your domain

Buy the domain, then in the Vercel dashboard: **Project → Settings → Domains →
Add**. Vercel issues the TLS certificate. Afterwards set `SITE.url` in
`public/js/config.js` to the real address so the share links stop pointing at
the preview host.

## How the hosting is configured

Everything is in [`vercel.json`](../vercel.json). There is no build step — the
`public/` folder is served as-is.

| Setting | Why |
| --- | --- |
| `outputDirectory: public` | The whole site is static |
| `rewrites: /app → /app.html` | Keeps the builder on a clean `/app` URL |
| `sw.js` served `must-revalidate` | A cached service worker pins a stale app forever |
| `/icons/*` cached a year, immutable | They never change |
| `nosniff`, `SAMEORIGIN`, referrer and permissions policies | Sensible defaults; the app needs no camera, mic or location |

## Installing it as an app

The site is a PWA, so it installs from the browser with no app store.

**Android / Chrome / Edge / desktop** — install controls appear in the toolbar,
the mobile menu, the share section and the builder's *More* menu when the
browser offers it. They stay hidden otherwise, because a control that does
nothing is worse than no control.

Clicking one opens a dialog explaining what installing gives you, with
**Cancel** and **Install**. The browser's own prompt fires only on Install,
because it can be shown once and reading about it should not spend it.

**iPhone / iPad** — Safari has no install prompt. The same dialog detects iOS
and lists the three Share-sheet taps instead, with no Install button, since
there is nothing for it to call.

Once installed it opens in its own window with no browser chrome, starting at
`/app`. Long-pressing the icon offers two shortcuts: **Rate my CV** and
**Build a CV**.

### What works offline

All of it. The service worker caches the shell on first visit, and the app never
needed a server anyway — the CV lives in `localStorage`, the checker is plain
JavaScript, and the PDF export is the browser's own print dialog. You can build
and export a CV on a plane.

Pages, code and styles go to the network first and fall back to the cache when
there is none, so a deploy is visible immediately and the app still opens with
no connection. Icons are served from cache, since they never change without
changing name.

An earlier version served everything from cache first. It was faster by a few
milliseconds and meant a deploy stayed invisible for a whole extra load - the
live site kept running an old config long after it had been replaced. Not worth
it.

### After changing the app

Bump `VERSION` in [`public/sw.js`](../public/sw.js):

```js
const VERSION = 'ihatejob-v2';
```

The old cache is deleted on activation. Without this, someone who installed the
app could keep the old copy indefinitely.

### Checking the install works

1. Open the site in Chrome, DevTools → **Application → Manifest**. No warnings.
2. **Application → Service Workers** shows one activated worker.
3. Tick **Offline** in that panel and reload — the app should still load.
4. The install controls should be visible, and clicking one should open the
   dialog rather than the browser's prompt. Cancel should leave the offer
   intact, so a second click opens the dialog again.

## Regenerating the icons

The PNGs in `public/icons/` were rasterised from the inline logo. If you change
the mark, regenerate them rather than editing the PNGs: open the site, paste the
generator from the project history into the console, or redraw at 192, 512
(plain), 512 (maskable, 18% safe-zone padding) and 180 (Apple touch).
