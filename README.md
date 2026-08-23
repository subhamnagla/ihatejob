# ihatejob

**Live: <https://ihatejob.vercel.app>** &nbsp;·&nbsp; installs as an app &nbsp;·&nbsp; works offline

A free, offline-first CV builder that tells you what is wrong with your CV.

Most free CV tools give you three templates, no guidance, and no way to judge
whether what you wrote is any good. This one is built around four problems:

1. **Not enough formats to compare.** Eight templates, switchable in one click,
   with the same content.
2. **No idea what "professional" means for your field.** Forty-one profession
   packs and twenty regional rule sets change the section order, the section
   names, the target length and what counts as evidence — and each profession
   ships a worked sample CV you can look at.
3. **No feedback.** A rating out of 100 across six named characters, naming
   every specific problem — the exact bullet, the exact phrase.
4. **Text pasted from a chatbot that the applicant cannot evaluate.** The
   checker flags the phrases that read as machine-written and offers plain
   replacements.

No account, no upload, no tracking, no AI service. Everything runs in the
browser and stays on the machine.

## Run it

```bash
npm --prefix C:/SideProjects/ihatejob run dev
```

Open <http://localhost:5190> for the landing page, or
<http://localhost:5190/app> to go straight to the builder. Set `PORT` to change
the port.

There is **no build step and nothing to install.** `server.mjs` is a static file
server written against `node:http`. Edit a file, refresh, done.

## What it does

### Eight templates

| Template | Layout | Best for |
| --- | --- | --- |
| **Classic** | Single column, centred header | General applications |
| **Minimal** | Single column, wide margins | Design and senior profiles |
| **ATS Plain** | Black only, real disc bullets, photo suppressed | Job portals and parsers |
| **Executive** | Headings in a left margin column | Long careers |
| **Modern** | Colour sidebar, left | One-page CVs led by skills |
| **Creative** | Accent banner, right rail | Portfolios and studios |
| **Academic** | Long-form, numbered publications | Research records |
| **Detailed** | Dense, boxed, bio-data style | Government and PSU forms |

### 41 profession packs

Across nine groups: Technology (software, data/ML, product, cybersecurity, IT
support), Engineering (core, architecture, agriculture), Health & Life sciences
(nursing, pharmacy, dentistry, physiotherapy, psychology, lab technology,
veterinary), Legal & Public (law, government/PSU, social work/NGO, defence
veterans), Business (finance, consulting, marketing, sales, HR, operations,
banking/BFSI, insurance/actuarial, real estate), Creative & Media (design,
journalism, film/VFX, content writing), Service & Hospitality (hotels, culinary,
aviation, retail, skilled trades), Education & Academic, and Early career.

**Every one has a worked sample CV** written to pass the checker — open it in the
preview without touching your own, then use it as a starting point if you want.

Choosing one rewrites the layout, the section order and the section names —
"Experience" becomes *Clinical Experience* for nursing and *Academic
Appointments* for research — and turns on the sections that field needs, such as
licences and registrations or publications.

### 20 region rule sets

India, US, UK, Ireland, Canada, Australia/NZ, Germany/Austria, Netherlands,
France, Nordics, UAE/Gulf, Singapore, Malaysia, Philippines, Japan, China,
South Korea, South Africa, Nigeria, Brazil/LatAm.

Regions carry consequences, not decoration. A photo is conventional in Germany
and disqualifying in the US, so selecting the US switches the photo off and the
checker raises a blocker if personal details like date of birth appear anywhere
in the document.

### The rating

Upload or paste a CV and it is graded out of 100 across six characters, each with
its own letter grade:

| Character | What it measures |
| --- | --- |
| **Evidence** | Do your claims carry numbers, or only adjectives? |
| **Authenticity** | Does it read as written by a person who did the work? |
| **Precision** | Tight, consistent, specific lines — not padding |
| **Field fit** | Does it contain what this profession expects to see? |
| **Machine-readability** | Will screening software parse it and pass it on? |
| **Restraint** | Right length, no keyword stuffing, nothing padded |

You also get a planet, from Mercury at the bottom to the Sun at the top, with a
star rating for each rung — the memorable half of the same number.

It arrives as a flyby: the screen goes to deep space and the rail travels
outward from Mercury, decelerating onto the planet you earned. The card lands,
the score counts up and the stars pop in one at a time. The whole thing runs
0.9-2 seconds depending on how far you got, so a strong CV takes the longer
trip. Click anywhere to skip it, and it is disabled entirely under
`prefers-reduced-motion`.

Splitting the score matters: a CV can be immaculately formatted and say nothing
(Machine-readability A, Evidence E), and those are different failures. Findings
are then listed as *fix before you send*, *worth fixing* and *polish*, each
quoting the offending text with a button that jumps to the field.

A sample of what it catches:

- Phrases that read as generated — *leveraged*, *spearheaded*, *results-driven*,
  *passionate about*, *robust*, *seamless* — with the plain replacement
- Claims with no number behind them (*significantly improved*)
- Bullets that describe duties rather than achievements (*responsible for*)
- The percentage of bullets carrying a figure, against a 40% target
- First person, essay connectives (*furthermore*), bullets over 34 words
- Missing sections for your profession, missing portfolio link, keyword stuffing
- Bullets that are all suspiciously the same length — one of the more reliable
  signs of generated text
- Reversed dates, mixed date formats, employment gaps over six months
- Page count against the profession and region target

Every rule is deterministic and runs offline. Nothing is sent anywhere.

### Cover letters

A second document sharing the CV's name block, typeface and accent, on its own
tab. Fill in the role, company and recipient; the greeting, subject line and
address block assemble themselves. **Start from a structure** lays out the four
paragraphs that do the job, with every claim left as a `[bracketed prompt]` for
you to replace — the editor counts how many are still unreplaced, because
brackets print exactly as they appear. Exports as PDF, Word, HTML or text under
its own filename.

### Clean up automatically

The rating tells you what is wrong; **Clean up automatically** fixes what a
machine can fix safely — replacing *leveraged* with *used*, deleting empty
claims, stripping a leading *I*, normalising date formats to the region's
convention, removing personal details a region forbids, and making bullet
punctuation consistent. Each fix is listed with a count and can be unticked.

Two things are deliberately **not** automated: rewriting *"Responsible for
developing X"* needs verb morphology that turns *ran* into *runned*, and adding
numbers to bullets would mean inventing facts. Those stay flagged for you. A
guard also reverts any rewrite that would leave broken English — a clause that
lost its subject, or a line cut to almost nothing.

### Import an existing CV

Drop in a PDF, a `.docx`, or paste the text. The file is read in the browser —
`.docx` is unzipped with `DecompressionStream`, PDFs are decoded from their
content streams. Text is parsed into sections, roles, dates, skills and scores,
shown as a report for you to confirm, and then checked.

Parsing a CV from formatting alone is approximate and the app says so. PDFs that
are scans, or that use embedded font encodings, cannot be read at all — it tells
you to paste the text instead rather than producing nonsense.

### Downloads

- **PDF** via the print dialog (set Margins to None, Background graphics on)
- **Word `.doc`** — opens in Word and Google Docs. Sidebar templates flatten to
  one column; Classic, Minimal, ATS Plain and Executive convert faithfully
- **Self-contained `.html`**
- **Plain `.txt`** for portals that reject formatted uploads
- **`.json`** backup you can re-open later

## Known limitation: multi-page printing

Page padding lives inside the document rather than in `@page`. That is what lets
Modern and Creative bleed colour to the sheet edge — the cost is that a second
printed page loses the top padding and the sidebar background. The preview draws
a red line at each page break and warns when a sidebar format runs past page
one. For longer CVs use Classic, Minimal, ATS Plain, Executive or Academic.

## Dark and light

Both themes ship, following your system preference on first load and remembered
after that. The CV page itself stays white in both — it is paper, and it has to
print.

## Install it as an app

The site is a PWA. An **Install app** button appears in the toolbar where the
browser supports it; on iOS Safari it is **Share → Add to Home Screen**. Once
installed it runs in its own window, starts at the builder, offers *Rate my CV*
and *Build a CV* as icon shortcuts, and works with no network at all.

## Deploying

Already deployed to Vercel. **The current deployment is unclaimed** — run
`npx vercel login` then `npx vercel claim` to move it into your account before
attaching a domain. Full details, including how to add your domain and when to
bump the service worker version:
[docs/deploying.md](docs/deploying.md).

## Admin

Moderate reviews, write blog posts, read feedback, and check the site's own
setup. Full guide: **[docs/admin.md](docs/admin.md)**.

Protected by a username and password checked in
[`middleware.js`](middleware.js) at the edge, before any file is served — a
password checked in browser JavaScript is not a password, it ships to every
visitor. Set `ADMIN_USER` and `ADMIN_PASSWORD` in the Vercel project settings,
and optionally `ADMIN_PATH` to move it to an address only you know. **With no
password set, the admin refuses to load** rather than standing open.

Saving commits `public/data/*.json` back to GitHub, so every change is a commit
you can revert, and there is no database to run.

It cannot show you anyone's CV or who visited — none of that is collected.

## Blog

`/blog`, written from the admin, stored in `public/data/posts.json`. Drafts stay
unpublished until you tick the box.

## Before you launch it

Three things live in [`public/js/config.js`](public/js/config.js):

| Setting | What it does |
| --- | --- |
| `SITE.repo` | Where the suggestion form and every "open an issue" link point. **Change `your-username`** or those links stay disabled. |
| `SITE.contactEmail` | Fallback inbox for reviews and suggestions before the repository is public. **Set at least one of these two**, or visitors have no way to reach you. |
| `STATS.endpoint` | A JSON summary of your analytics. Visitor numbers appear once it returns real figures. |
| `STATS.minVisitors` | Below this, visitor numbers stay off the page entirely. Default 100. |
| `REVIEWS` | Ships **empty on purpose**. |
| `MIN_REVIEWS` | The reviews section appears once you have this many. Default 3. |

**Where it all arrives:** [docs/receiving-feedback.md](docs/receiving-feedback.md)
— which page to watch, the labels to create first (GitHub silently drops labels
that do not exist), and how to turn on notifications.

**How visitors send you a review.** Reviews have their own section and their own
form, separate from the issue form under *Open source*. A review and a bug
report are different acts by different people; sharing one dropdown between them
made both read as paperwork.

The rating is a **planet**, picked from the same Mercury-to-the-Sun scale the
checker uses on a CV, so nobody has to think in numbers. The form writes a fixed
header that the admin reads back, which is how the planet, the credit and the
consent answer survive the trip through GitHub:

```
Rating: Jupiter (5 of 10, 2.5 stars)
Credit: Asha R - Staff nurse, Leeds
May be quoted on the site: yes

...the review itself
```

Stars are always derived from the planet — half a star per rung — rather than
stored beside it, so the two cannot drift apart.

Submitting goes to the repository if `SITE.repo` is set, otherwise to
`SITE.contactEmail`, and if **neither** is configured it copies to the clipboard
and says plainly that nothing was sent. Set one of them before launch.

**On the repository link.** While `SITE.repo` still contains `your-username`,
every "open an issue" control detects it and scrolls to the on-page suggestion
form instead of sending someone to a GitHub 404, pre-selecting the right
category. Point it at a real repository and they become direct issue links.

**On visitor numbers.** The front page can show visitors and CVs rated, read
from whatever you point `STATS.endpoint` at - Plausible, Umami, GoatCounter and
Fathom all expose a summary API, and a Cloudflare Worker holding a counter in KV
works too.

Until the endpoint is set, or while the figures are below `minVisitors`, those
cells are **not on the page at all** - no dash, no placeholder, no explanation.
A visitor sees only the four facts that are true from day one. "17 visitors" is
worse than saying nothing. The reason is logged to the browser console, where
only you will look.

**On reviews.** No testimonials ship with this. A brand-new site showing five
glowing quotes from people who do not exist is the fastest way to lose a
visitor, and it is the first thing anyone checks.

The whole section - heading, nav link and all - stays out of the page until
`MIN_REVIEWS` are visible, then appears on its own. The review form stays on the
page throughout, so people can send you reviews before the section exists. Each
entry needs a name, a role, a planet, and ideally a link to where they said it.

## Privacy

Nothing leaves the machine. The CV lives in `localStorage` under `ihatejob.v1`.
Uploaded photos are centre-cropped to a 420px JPEG and stored in the same
record. There is no analytics, no telemetry, no font CDN and no upload endpoint.
*More → Clear everything* wipes it.

## Contributing

New professions, regions, templates and checker rules are the most useful
contributions, and the first two need field knowledge more than code.

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [Adding a profession](docs/adding-a-profession.md)
- [Adding a template](docs/adding-a-template.md)
- [Where reviews and suggestions arrive](docs/receiving-feedback.md)
- [Deploying and installing as an app](docs/deploying.md)

## Layout of the code

```
server.mjs                static file server (node:http only); "/" is the site, "/app" the builder
public/index.html         landing page
public/app.html           the builder
public/css/site.css       landing page styles
public/js/site.js         landing page logic
public/js/config.js       domain, repo, analytics endpoint, reviews
public/admin.html         admin dashboard (public data only)
public/js/admin.js        admin logic: health, GitHub inbox, integrity checks
middleware.js             edge auth for the admin: password, secret address
api/content.js            saves reviews and posts back to the repository
public/blog.html          blog listing and post view
public/js/blog.js         blog rendering and a small Markdown subset
public/data/*.json        reviews and posts, edited from the admin
public/js/pwa.js          install prompt and service worker registration
public/sw.js              offline cache
public/manifest.webmanifest  app identity, icons, shortcuts
vercel.json               hosting config: routing, headers, caching
public/css/app.css        editor UI
public/css/cv.css         the document: structure, .tpl-* skins, print rules
public/js/schema.js       data model, form schema, sample CV
public/js/professions.js  profession packs and region rules
public/js/templates.js    CV rendering and plain-text export
public/js/review.js       the checker
public/js/import.js       PDF/DOCX extraction and CV text parsing
public/js/form.js         builds the editor from the schema
public/js/main.js         state, events, preview, storage, exports
```

## Licence

MIT — see [LICENSE](LICENSE).
